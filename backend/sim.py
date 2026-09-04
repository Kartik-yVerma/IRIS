"""IRIS — rover mission simulator (PRD FR-711).

Drives the complete loop without hardware: the rover patrols the Ghat Section
on the track geometry, captures synthetic camera frames every 200 m, runs the
real OpenCV pipeline on them, fuses visual + vibration + position evidence
(PRD §15.1), scores risk (§15.2), deduplicates detections into inspection
events, stores them, and streams telemetry + alerts over SSE.

Mission time is compressed (~15 m of track per second) so a full patrol lap
completes in a few minutes — the point is to *see* the loop working.
"""
import asyncio
import json
import random
import sqlite3
import time
import uuid
from collections import deque
from datetime import datetime, timedelta

import frames
import vision
from track import TRACK, FRAME_INTERVAL_M, frame_chainage, patrol_frame_count

SEVERITY_BY_CLASS = {
    "surface_crack": "high", "broken_rail": "critical",
    "missing_fastener": "medium", "joint_anomaly": "high",
    "foreign_object": "medium", "vegetation": "low",
}
SEVERITY_BASE = {"low": 20, "medium": 40, "high": 65, "critical": 85}
ZONE_MULT = {"Metro Corridor": 0.95, "Foothills": 1.0,
             "Ghat Section": 1.15, "Plateau": 0.9}
# fusion weights (PRD §15.1 — prototype values, versioned in code)
W_VISUAL, W_VIB, W_POS = 0.50, 0.35, 0.15
# FP gate: high-noise classes only create events above this confidence.
# missing_fastener is gated hard (its classical detector has low precision —
# see model metrics); the Vision Lab still demos it directly on frames.
CONF_GATE = {"missing_fastener": 0.85, "surface_crack": 0.62}
SPEED_M_PER_TICK = 40.0          # mission-time compressed: 80 m of track / s
TICK_S = 0.5

VIB_CLASSES = ("surface_crack", "broken_rail", "joint_anomaly")
SIGNAL_DIP = (84800.0, 85200.0)       # chainage window: weak link
GNSS_WINDOW = (89500.0, 90500.0)      # chainage window: poor GNSS (cutting)


class Sim:
    def __init__(self, db: sqlite3.Connection):
        self.db = db
        self.rng = random.Random(42)
        self.queue = asyncio.Queue()
        self.ring = deque(maxlen=60)          # SSE replay buffer
        self.started_at = time.time()
        self._last_frame = None

        patrol = TRACK.patrol
        self.rover = {
            "id": "IRIS-R1",
            "name": "Ghat Sentinel",
            "status": "mission",              # mission | paused | charging | safe_stop
            "battery": 86.0,
            "speed_mps": 0.9,
            "temp_c": 41.5,
            "signal_dbm": -58,
            "camera_on": True,
            "firmware": "iris-1.4.2",
            "zone": patrol["zone"],
            "chainage_m": patrol["start_m"] + 2400.0,
            "uncertainty_m": 1.6,
            "health": {"gnss": "ok", "imu": "ok", "camera": "ok",
                       "storage": "ok", "compute": "ok"},
            "lap": 1,
            "direction": 1,                     # +1 outbound · −1 return
            "heading_deg": 0.0,
        }
        self.mission = {
            "id": "MIS-0042",
            "rover_id": "IRIS-R1",
            "status": "active",
            "started": datetime.now().isoformat(timespec="seconds"),
            "inspected_today_km": 4.6,
            "captures": 0,
            "events_created": 0,
            "laps": 0,
        }
        self._last_capture_chainage = self.rover["chainage_m"]
        self._lap_flags = set()               # health flags already emitted this lap
        self._charging_ticks = 0
        self.latest = None                    # latest processed frame payload

    # ------------------------------------------------------------------ SSE
    def push(self, etype, payload):
        msg = {"type": etype, "payload": payload, "seq": int(time.time() * 1000)}
        self.ring.append(msg)
        try:
            self.queue.put_nowait(msg)
        except Exception:
            pass

    # ------------------------------------------------------------ position
    def _position(self):
        lat, lng = TRACK.offset_latlng(self.rover["chainage_m"], 0.0)
        self.rover["lat"], self.rover["lng"] = round(lat, 6), round(lng, 6)

    # ---------------------------------------------------------------- tick
    async def tick(self):
        r = self.rover
        patrol = TRACK.patrol
        if r["status"] == "mission":
            r["chainage_m"] += SPEED_M_PER_TICK * r["direction"]
            r["heading_deg"] = round(TRACK.bearing_at(r["chainage_m"],
                                                      r["direction"]), 1)
            r["speed_mps"] = round(0.9 + self.rng.uniform(-0.05, 0.08), 2)
            r["battery"] = max(18.0, r["battery"] - 0.03)
            self.mission["inspected_today_km"] = round(
                self.mission["inspected_today_km"] + 0.012, 3)
            r["temp_c"] = round(41.0 + self.rng.uniform(0, 2.2), 1)
            r["signal_dbm"] = -58 + round(self.rng.uniform(-3, 3))
            if r["battery"] <= 22.0:
                r["status"] = "charging"
                self._charging_ticks = 0
                self.push("health_flag", {
                    "source": "battery", "level": "warning",
                    "message": "IRIS-R1 battery low — returning to dock"})
            # patrol loop: turn around at the ends, no teleporting
            if r["chainage_m"] >= patrol["end_m"]:
                r["chainage_m"] = patrol["end_m"]
                r["direction"] = -1
                self.push("rover_event", {"kind": "turnaround",
                                          "at": "end",
                                          "message": "End of patrol reached — turning around"})
            elif r["chainage_m"] <= patrol["start_m"]:
                r["chainage_m"] = patrol["start_m"]
                r["direction"] = 1
                r["lap"] += 1
                self.mission["laps"] += 1
                self._lap_flags.clear()
                self.push("rover_event", {"kind": "lap_complete",
                                          "lap": r["lap"]})
        elif r["status"] == "charging":
            self._charging_ticks += 1
            r["battery"] = min(98.0, r["battery"] + 0.8)
            r["speed_mps"] = 0.0
            if r["battery"] >= 96.0 or self._charging_ticks > 40:
                r["status"] = "mission"
                self.push("rover_event", {"kind": "mission_resumed"})
        elif r["status"] in ("paused", "safe_stop"):
            r["speed_mps"] = 0.0

        # degraded-mode windows (deterministic, per lap)
        c = r["chainage_m"]
        if r["status"] == "mission":
            if SIGNAL_DIP[0] <= c <= SIGNAL_DIP[1] and "sig" not in self._lap_flags:
                self._lap_flags.add("sig")
                r["signal_dbm"] = -96
                self.push("health_flag", {
                    "source": "link", "level": "warning",
                    "message": "Weak telemetry link — rover continues offline buffering"})
            if GNSS_WINDOW[0] <= c <= GNSS_WINDOW[1] and "gnss" not in self._lap_flags:
                self._lap_flags.add("gnss")
                r["uncertainty_m"] = 9.4
                r["health"]["gnss"] = "degraded"
                self.push("health_flag", {
                    "source": "gnss", "level": "warning",
                    "message": "GNSS degraded in cutting — dead-reckoning engaged"})
            if c < GNSS_WINDOW[0] - 400 and r["health"]["gnss"] != "ok":
                r["health"]["gnss"] = "ok"
                r["uncertainty_m"] = 1.6
            if c < SIGNAL_DIP[0] - 400 and r["signal_dbm"] < -80:
                r["signal_dbm"] = -58

        self._position()
        await self._maybe_capture()

    # ------------------------------------------------------------ capture
    async def _maybe_capture(self):
        if self.rover["status"] != "mission":
            return
        d = abs(self.rover["chainage_m"] - self._last_capture_chainage)
        if d < FRAME_INTERVAL_M:
            return
        self._last_capture_chainage = self.rover["chainage_m"]
        patrol = TRACK.patrol
        frame_idx = int((self.rover["chainage_m"] - patrol["start_m"])
                        / FRAME_INTERVAL_M) % patrol_frame_count()
        img, gt, meta = frames.get_frame(frame_idx)
        res = await asyncio.to_thread(vision.analyze, img)
        self.mission["captures"] += 1

        # degraded image quality → health flag (FR-306)
        if res["quality"]["degraded"] and "img" not in self._lap_flags:
            self._lap_flags.add("img")
            self.push("health_flag", {
                "source": "image_quality", "level": "warning",
                "message": f"Camera image degraded on frame f{frame_idx:04d} "
                           "(blur/brightness) — evidence marked"})

        vib_score = self._vibration(gt)
        detections = []
        for det in res["detections"]:
            gate = CONF_GATE.get(det["class"], 0.0)
            if det["confidence"] < gate:
                continue
            detections.append(det)

        payload = {
            "frame_id": f"f{frame_idx:04d}",
            "chainage_m": round(self.rover["chainage_m"], 1),
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "quality": res["quality"],
            "rails_found": res["rails_found"],
            "latency_ms": res["latency_ms"],
            "detections": [{
                **d,
                "chainage_m": round(self.rover["chainage_m"]
                                    + self._lookahead_m(d["bbox"]), 1),
            } for d in detections],
            "vibration": {"score": vib_score,
                          "rms": round(0.08 + vib_score * 0.6, 3),
                          "anomaly": vib_score > 0.5},
        }
        self.latest = payload
        self.push("frame_processed", payload)
        for det in detections:
            await self._make_event(det, frame_idx, vib_score, gt)

    # --------------------------------------------------------------- maths
    def _lookahead_m(self, bbox):
        """Camera geometry: bbox depth in frame → metres ahead of the rover."""
        cy = bbox[1] + bbox[3] / 2.0
        t = max(0.0, min(1.0, (cy - 168) / (360 - 168)))
        return 26.0 - t * 23.0

    def _vibration(self, gt):
        if any(g["class"] in VIB_CLASSES for g in gt):
            return round(0.55 + self.rng.random() * 0.4, 3)
        return round(0.05 + self.rng.random() * 0.12, 3)

    async def _make_event(self, det, frame_idx, vib_score, gt):
        rover_c = self.rover["chainage_m"]
        chainage = rover_c + self._lookahead_m(det["bbox"])
        chainage = min(chainage, TRACK.total_m)
        lateral = ((det["bbox"][0] + det["bbox"][2] / 2.0) - 320) / 320 * 1.4
        lat, lng = TRACK.offset_latlng(chainage, lateral)
        unc = round(min(9.9, self.rover["uncertainty_m"] + self.rng.uniform(0.2, 0.9)), 1)
        pos_consistency = max(0.5, 1 - unc / 22.0)
        fused = round(W_VISUAL * det["confidence"] + W_VIB * vib_score
                      + W_POS * pos_consistency, 3)
        zone = TRACK.zone_at(chainage)
        severity = SEVERITY_BY_CLASS[det["class"]]

        # duplicate-event suppression: same class within ±3 m (PRD FR-704)
        row = self.db.execute(
            """SELECT id, status, recurrence, ts FROM events
               WHERE class=? AND ABS(chainage_m-?) < 3.0
               ORDER BY ts DESC LIMIT 1""",
            (det["class"], chainage)).fetchone()
        now = datetime.now()
        now_iso = now.isoformat(timespec="seconds")
        if row and row["status"] not in ("resolved", "dismissed"):
            # same physical defect seen again on a later patrol → recurrence
            rec = row["recurrence"] + 1
            risk = self._risk(severity, det["confidence"], fused, rec, zone["name"])
            self.db.execute(
                "UPDATE events SET recurrence=?, risk_score=?, fused_score=?, "
                "confidence=?, ts=? WHERE id=?",
                (rec, risk, fused, det["confidence"], now_iso, row["id"]))
            self.db.commit()
            self._audit("system", "recurrence_update", row["id"],
                        f"re-detected by {self.rover['id']}, recurrence→{rec}")
            self.push("event_updated", {"id": row["id"], "recurrence": rec,
                                        "risk_score": risk})
            return

        recurrence = self.db.execute(
            "SELECT COUNT(*) FROM events WHERE class=? AND ABS(chainage_m-?)<3.0",
            (det["class"], chainage)).fetchone()[0]
        risk = self._risk(severity, det["confidence"], fused, recurrence,
                          zone["name"])
        trend = "recurring" if recurrence >= 3 else \
                ("degrading" if recurrence >= 1 else "stable")
        ev = {
            "id": f"EV-{uuid.uuid4().hex[:10].upper()}",
            "class": det["class"], "severity": severity, "status": "open",
            "confidence": det["confidence"], "fused_score": fused,
            "risk_score": risk, "chainage_m": round(chainage, 1),
            "lat": round(lat, 6), "lng": round(lng, 6),
            "uncertainty_m": unc, "zone": zone["name"],
            "segment": TRACK.segment_at(chainage), "ts": now_iso,
            "recurrence": recurrence, "trend": trend,
            "frame_id": f"f{frame_idx:04d}", "rover_id": self.rover["id"],
            "sensor": {
                "visual": {"score": det["confidence"], "quality":
                           "degraded" if self.latest["quality"]["degraded"] else "ok"},
                "vibration": {"score": vib_score,
                              "rms": round(0.08 + vib_score * 0.6, 3),
                              "anomaly": vib_score > 0.5},
                "position": {"consistency": round(pos_consistency, 3),
                             "uncertainty_m": unc},
            },
            "history": [{"status": "open", "actor": "edge:iris-r1",
                         "ts": now_iso, "note": "auto-detected by edge vision"}],
            "note": "",
        }
        self.db.execute(
            """INSERT INTO events (id, class, severity, status, confidence,
               fused_score, risk_score, chainage_m, lat, lng, uncertainty_m,
               zone, segment, ts, recurrence, trend, frame_id, rover_id,
               sensor, history, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ev["id"], ev["class"], ev["severity"], ev["status"],
             ev["confidence"], ev["fused_score"], ev["risk_score"],
             ev["chainage_m"], ev["lat"], ev["lng"], ev["uncertainty_m"],
             ev["zone"], ev["segment"], ev["ts"], ev["recurrence"], ev["trend"],
             ev["frame_id"], ev["rover_id"], json.dumps(ev["sensor"]),
             json.dumps(ev["history"]), ev["note"]))
        self.db.commit()
        self.mission["events_created"] += 1
        self._audit("system", "event_created", ev["id"],
                    f"{ev['class']} @ {ev['chainage_m']}m")
        self.push("event_created", ev)
        if severity in ("high", "critical"):
            self.push("alert", {"id": ev["id"], "class": ev["class"],
                                "severity": severity, "chainage_m": ev["chainage_m"],
                                "message": f"{ev['class'].replace('_', ' ').title()} "
                                           f"at {ev['chainage_m']} m"})

    def _risk(self, severity, conf, fused, recurrence, zone):
        cf = 0.5 + 0.5 * fused
        bonus = min(15, 5 * recurrence)
        trend = 12 if recurrence >= 3 else (8 if recurrence >= 1 else 0)
        ctx = (ZONE_MULT.get(zone, 1.0) - 1.0) * SEVERITY_BASE[severity] * cf
        return max(0, min(100, round(SEVERITY_BASE[severity] * cf + bonus
                                     + trend + ctx)))

    # ------------------------------------------------------------ commands
    def command(self, action):
        r = self.rover
        if action == "start":
            r["status"] = "mission"
        elif action == "pause":
            if r["status"] == "mission":
                r["status"] = "paused"
        elif action == "resume":
            if r["status"] == "paused":
                r["status"] = "mission"
        elif action == "safe_stop":
            r["status"] = "safe_stop"
        else:
            return False
        self._audit("operator", f"rover_{action}", r["id"], f"status→{r['status']}")
        self.push("rover_event", {"kind": action, "rover_id": r["id"]})
        return True

    def _audit(self, actor, action, entity, detail):
        self.db.execute(
            "INSERT INTO audit (ts, actor, action, entity, detail) VALUES (?,?,?,?,?)",
            (datetime.now().isoformat(timespec="seconds"), actor, action,
             entity, detail))
        self.db.commit()

    # ------------------------------------------------------------- telemetry
    def telemetry_payload(self):
        r = self.rover
        patrol = TRACK.patrol
        span = patrol["end_m"] - patrol["start_m"]
        progress = (r["chainage_m"] - patrol["start_m"]) / span * 100
        return {**r, "mission_progress_pct": round(progress, 1),
                "mission": self.mission["id"]}

    async def run(self):
        while True:
            try:
                await self.tick()
                self.push("rover_telemetry", self.telemetry_payload())
            except Exception:
                pass
            await asyncio.sleep(TICK_S)
