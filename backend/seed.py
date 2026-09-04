"""IRIS — deterministic 14-day inspection history for the demo dashboard.

Seeds realistic event distributions: the Ghat Section is the degradation
hotspot, older events are mostly resolved, recent ones still open. Fully
deterministic so restarts reproduce the same history (PRD §17.2).
"""
import json
import random
import uuid
from datetime import datetime, timedelta

from track import TRACK

SEED = 20260821

CLASS_WEIGHTS = [
    ("surface_crack", 30), ("missing_fastener", 22), ("foreign_object", 15),
    ("joint_anomaly", 13), ("vegetation", 12), ("broken_rail", 8),
]
SEVERITY_BY_CLASS = {
    "surface_crack": "high", "broken_rail": "critical",
    "missing_fastener": "medium", "joint_anomaly": "high",
    "foreign_object": "medium", "vegetation": "low",
}
SEVERITY_BASE = {"low": 20, "medium": 40, "high": 65, "critical": 85}
ZONE_MULT = {"Metro Corridor": 0.95, "Foothills": 1.0,
             "Ghat Section": 1.15, "Plateau": 0.9}
STATUSES = ["open", "acknowledged", "verified", "assigned", "in_repair",
            "resolved", "resolved", "resolved", "dismissed"]
ZONE_SPREAD = [("Ghat Section", 0.42), ("Foothills", 0.22),
               ("Plateau", 0.21), ("Metro Corridor", 0.15)]


def _risk(severity, conf, recurrence, zone):
    cf = 0.5 + 0.5 * conf
    bonus = min(15, 5 * recurrence)
    trend = 0
    if recurrence >= 3:
        trend = 12
    elif recurrence >= 1:
        trend = 8
    ctx = (ZONE_MULT.get(zone, 1.0) - 1.0) * SEVERITY_BASE[severity] * cf
    risk = SEVERITY_BASE[severity] * cf + bonus + trend + ctx
    return max(0, min(100, round(risk)))


def _sensor(conf, vib, unc):
    return {
        "visual": {"score": round(conf, 3), "quality": "ok"},
        "vibration": {"score": round(vib, 3),
                      "rms": round(0.08 + vib * 0.6, 3),
                      "anomaly": vib > 0.5},
        "position": {"consistency": round(max(0.55, 1 - unc / 25), 3),
                     "uncertainty_m": unc},
    }


def _history(ts, status):
    path = {"open": [], "acknowledged": ["open"], "verified": ["open", "acknowledged"],
            "assigned": ["open", "acknowledged", "verified"],
            "in_repair": ["open", "acknowledged", "verified", "assigned"],
            "resolved": ["open", "acknowledged", "verified", "assigned", "in_repair"],
            "dismissed": ["open"]}
    h = []
    t = ts
    for st in path[status]:
        t = t + timedelta(minutes=random.Random(hash(st) % 9999).randint(6, 40))
        h.append({"status": st, "actor": "engineer.priya", "ts": t.isoformat(),
                  "note": ""})
    return h


def seed_events(now=None):
    rng = random.Random(SEED)
    now = now or datetime.now()
    events = []
    recurrences = {}          # chainage bucket → count (drives trend factor)
    for i in range(112):
        days_ago = rng.uniform(0.02, 13.6)
        ts = now - timedelta(days=days_ago)
        cls = rng.choices([c for c, _ in CLASS_WEIGHTS],
                          weights=[w for _, w in CLASS_WEIGHTS])[0]
        zone = rng.choices([z for z, _ in ZONE_SPREAD],
                           weights=[w for _, w in ZONE_SPREAD])[0]
        z = TRACK.zone_by_name[zone]
        chainage = z["start_m"] + rng.random() * (z["end_m"] - z["start_m"])
        # slight recurrence clustering: 25% of events land near a previous one
        if recurrences and rng.random() < 0.25:
            anchor = rng.choice(list(recurrences.keys()))
            chainage = anchor + rng.uniform(-6, 6)
        bucket = int(chainage // 10)
        recurrences[bucket] = recurrences.get(bucket, 0) + 1
        recurrence = recurrences[bucket] - 1

        conf = round(rng.uniform(0.72, 0.97), 3)
        vib = round(0.55 + rng.random() * 0.4, 3) if cls in (
            "surface_crack", "broken_rail", "joint_anomaly") \
            else round(rng.uniform(0.06, 0.3), 3)
        unc = round(rng.uniform(1.2, 4.5), 1)
        severity = SEVERITY_BY_CLASS[cls]
        if cls == "surface_crack" and rng.random() < 0.2:
            severity = "critical"
        lat, lng = TRACK.offset_latlng(chainage,
                                       rng.uniform(-0.9, 0.9))
        status = rng.choices(STATUSES,
                             weights=[6, 4, 3, 2, 3, 14, 14, 14, 2])[0]
        # very recent events are open-ish, ancient ones resolved-ish
        if days_ago < 1.5 and status in ("resolved", "dismissed"):
            status = rng.choice(["open", "acknowledged", "verified"])
        fidx = rng.randint(0, 89)
        ev = {
            "id": f"EV-{uuid.uuid4().hex[:10].upper()}",
            "class": cls,
            "severity": severity,
            "status": status,
            "confidence": conf,
            "fused_score": round(0.5 * conf + 0.35 * vib + 0.15 * max(0.55, 1 - unc / 25), 3),
            "risk_score": _risk(severity, conf, recurrence, zone),
            "chainage_m": round(chainage, 1),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "uncertainty_m": unc,
            "zone": zone,
            "segment": TRACK.segment_at(chainage),
            "ts": ts.isoformat(timespec="seconds"),
            "recurrence": recurrence,
            "trend": "recurring" if recurrence >= 3 else
                     ("degrading" if recurrence >= 1 else "stable"),
            "frame_id": f"f{fidx:04d}",
            "rover_id": "IRIS-R1",
            "sensor": _sensor(conf, vib, unc),
            "history": _history(ts, status),
            "note": "",
        }
        events.append(ev)
    events.sort(key=lambda e: e["ts"])
    return events
