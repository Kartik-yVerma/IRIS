"""IRIS — FastAPI backend (PRD §12). REST + SSE + evidence serving + SPA host."""
import asyncio
import base64
import hashlib
import io
import json
import os
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (FileResponse, JSONResponse, Response,
                               StreamingResponse)
from pydantic import BaseModel

import frames
import seed as seedmod
import vision
from sim import Sim
from track import TRACK, patrol_frame_count

BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "data"
DB_PATH = DATA_DIR / "iris.db"
FRAMES_DIR = BASE / "frames"
FRONTEND_DIST = BASE.parent / "frontend" / "dist"
METRICS_PATH = DATA_DIR / "model_metrics.json"

app = FastAPI(title="IRIS — Intelligent Railtrack Inspection System",
              version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

# ------------------------------------------------------------------- db
_db = sqlite3.connect(DB_PATH, check_same_thread=False)
_db.row_factory = sqlite3.Row
_db.execute("""CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, class TEXT, severity TEXT, status TEXT,
    confidence REAL, fused_score REAL, risk_score REAL, chainage_m REAL,
    lat REAL, lng REAL, uncertainty_m REAL, zone TEXT, segment TEXT,
    ts TEXT, recurrence INTEGER, trend TEXT, frame_id TEXT, rover_id TEXT,
    sensor TEXT, history TEXT, note TEXT)""")
_db.execute("""CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, actor TEXT, action TEXT,
    entity TEXT, detail TEXT)""")
_db.execute("""CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE,
    password_hash TEXT, salt TEXT, created_at TEXT)""")
_db.execute("""CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT)""")
_db.commit()

SIM = Sim(_db)
SIM_TASK = None


def _event_row_to_dict(row):
    e = dict(row)
    e["sensor"] = json.loads(e["sensor"]) if e["sensor"] else {}
    e["history"] = json.loads(e["history"]) if e["history"] else []
    return e


def _row_events(rows):
    return [_event_row_to_dict(r) for r in rows]


@app.on_event("startup")
async def startup():
    global SIM_TASK
    # seed deterministic 14-day history once
    count = _db.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    if count == 0:
        for ev in seedmod.seed_events():
            _db.execute(
                """INSERT INTO events (id, class, severity, status, confidence,
                   fused_score, risk_score, chainage_m, lat, lng, uncertainty_m,
                   zone, segment, ts, recurrence, trend, frame_id, rover_id,
                   sensor, history, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (ev["id"], ev["class"], ev["severity"], ev["status"],
                 ev["confidence"], ev["fused_score"], ev["risk_score"],
                 ev["chainage_m"], ev["lat"], ev["lng"], ev["uncertainty_m"],
                 ev["zone"], ev["segment"], ev["ts"], ev["recurrence"],
                 ev["trend"], ev["frame_id"], ev["rover_id"],
                 json.dumps(ev["sensor"]), json.dumps(ev["history"]),
                 ev["note"]))
        _db.commit()
    # warm the synthetic frame cache in a background thread
    threading.Thread(target=frames.warmup,
                     args=(range(patrol_frame_count()),),
                     daemon=True).start()
    SIM_TASK = asyncio.create_task(SIM.run())


# ------------------------------------------------------------------ helpers
def _annotated_png(frame_id, detections=None, force=False):
    path = FRAMES_DIR / "annotated" / f"{frame_id}.png"
    os.makedirs(path.parent, exist_ok=True)
    if not force and path.exists():
        return path
    idx = int(frame_id[1:])
    img, _, _ = frames.get_frame(idx)
    if detections is None:
        res = vision.analyze(img)
        detections = res["detections"]
    ann = vision.annotate(img, detections)
    cv2.imwrite(str(path), ann)
    return path


def _stage_png(frame_id, stage):
    path = FRAMES_DIR / "stages" / f"{frame_id}_{stage}.png"
    os.makedirs(path.parent, exist_ok=True)
    if path.exists():
        return path
    idx = int(frame_id[1:])
    img, _, _ = frames.get_frame(idx)
    res = vision.analyze(img, with_stages=True)
    stages = dict(res["stages"])
    if stage == "result":
        ann = vision.annotate(img, res["detections"])
        cv2.imwrite(str(path), ann)
    elif stage in stages:
        cv2.imwrite(str(path), stages[stage])
    else:
        raise HTTPException(404, "unknown stage")
    return path


# ------------------------------------------------------------------- auth
def _hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return h, salt


def _issue_token(user_id, name, email):
    token = secrets.token_hex(32)
    _db.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                (token, user_id, datetime.now().isoformat()))
    _db.commit()
    return {"token": token, "user": {"name": name, "email": email}}


def _session_user(authorization):
    token = (authorization or "").removeprefix("Bearer ").strip()
    row = _db.execute(
        """SELECT u.name, u.email FROM sessions s
           JOIN users u ON u.id = s.user_id WHERE s.token = ?""",
        (token,)).fetchone()
    if not row:
        raise HTTPException(401, "Not signed in")
    return {"name": row["name"], "email": row["email"]}


class SignupBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


@app.post("/api/auth/signup")
async def auth_signup(body: SignupBody):
    email = body.email.strip().lower()
    name = body.name.strip()
    if not name or len(name) > 60:
        raise HTTPException(400, "Name is required")
    if "@" not in email or "." not in email:
        raise HTTPException(400, "Enter a valid email address")
    if len(body.password) < 6:
        raise HTTPException(400, "Password needs at least 6 characters")
    if _db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise HTTPException(409, "An account with this email already exists")
    h, salt = _hash_password(body.password)
    cur = _db.execute(
        "INSERT INTO users (name, email, password_hash, salt, created_at) VALUES (?,?,?,?,?)",
        (name, email, h, salt, datetime.now().isoformat()))
    _db.commit()
    return _issue_token(cur.lastrowid, name, email)


@app.post("/api/auth/login")
async def auth_login(body: LoginBody):
    email = body.email.strip().lower()
    row = _db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row:
        raise HTTPException(401, "No account with this email")
    h, _ = _hash_password(body.password, row["salt"])
    if not secrets.compare_digest(h, row["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    return _issue_token(row["id"], row["name"], row["email"])


@app.get("/api/auth/me")
async def auth_me(authorization: str = Header(None)):
    return {"user": _session_user(authorization)}


@app.post("/api/auth/logout")
async def auth_logout(authorization: str = Header(None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    _db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    _db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- core APIs
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "IRIS", "version": "1.0.0",
            "events": _db.execute("SELECT COUNT(*) FROM events").fetchone()[0]}


@app.get("/api/track")
def get_track():
    # downsample polyline for the map (~every 30 m)
    pts = TRACK.points
    step = max(1, int(30 / 5))
    points = [[round(float(p[0]), 5), round(float(p[1]), 5)]
              for p in pts[::step]]
    if points[-1] != [round(float(pts[-1][0]), 5), round(float(pts[-1][1]), 5)]:
        points.append([round(float(pts[-1][0]), 5),
                       round(float(pts[-1][1]), 5)])
    return {
        "total_length_m": round(TRACK.total_m, 1),
        "patrol": TRACK.patrol,
        "stations": TRACK.stations,
        "zones": TRACK.zones,
        "points": points,
    }


@app.get("/api/rovers")
def get_rovers():
    live = SIM.telemetry_payload()
    fleet = [
        {"id": "IRIS-R2", "name": "Foothills Scout", "status": "standby",
         "battery": 98.0, "speed_mps": 0.0, "temp_c": 33.4, "signal_dbm": -54,
         "camera_on": False, "zone": "Foothills", "firmware": "iris-1.4.2",
         "mission_progress_pct": 0.0,
         "health": {"gnss": "ok", "imu": "ok", "camera": "ok",
                    "storage": "ok", "compute": "ok"}},
        {"id": "IRIS-R3", "name": "Metro Runner", "status": "charging",
         "battery": 61.0, "speed_mps": 0.0, "temp_c": 30.2, "signal_dbm": -51,
         "camera_on": False, "zone": "Metro Corridor", "firmware": "iris-1.4.0",
         "mission_progress_pct": 0.0,
         "health": {"gnss": "ok", "imu": "ok", "camera": "ok",
                    "storage": "ok", "compute": "ok"}},
        {"id": "IRIS-R4", "name": "Plateau Probe", "status": "maintenance",
         "battery": 44.0, "speed_mps": 0.0, "temp_c": 29.8, "signal_dbm": -66,
         "camera_on": False, "zone": "Plateau", "firmware": "iris-1.3.9",
         "mission_progress_pct": 0.0,
         "health": {"gnss": "ok", "imu": "check", "camera": "ok",
                    "storage": "ok", "compute": "ok"}},
    ]
    return [live, *fleet]


class CommandBody(BaseModel):
    action: str


@app.post("/api/rovers/{rover_id}/command")
def rover_command(rover_id: str, body: CommandBody):
    if rover_id != "IRIS-R1":
        raise HTTPException(404, "rover not found")
    if not SIM.command(body.action):
        raise HTTPException(400, "unknown action")
    return {"ok": True, "action": body.action}


@app.get("/api/missions/current")
def current_mission():
    m = dict(SIM.mission)
    m["rover"] = SIM.telemetry_payload()
    return m


@app.get("/api/events")
def list_events(status: str = None, severity: str = None, cls: str = None,
                zone: str = None, limit: int = Query(200, le=500)):
    q = "SELECT * FROM events WHERE 1=1"
    args = []
    if status:
        q += " AND status=?"; args.append(status)
    if severity:
        q += " AND severity=?"; args.append(severity)
    if cls:
        q += " AND class=?"; args.append(cls)
    if zone:
        q += " AND zone=?"; args.append(zone)
    q += " ORDER BY ts DESC LIMIT ?"
    args.append(limit)
    return {"events": _row_events(_db.execute(q, args).fetchall())}


@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    row = _db.execute("SELECT * FROM events WHERE id=?",
                      (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "event not found")
    ev = _event_row_to_dict(row)
    ev["image_url"] = f"/api/events/{event_id}/image"
    ev["evidence_url"] = f"/api/evidence/{ev['class']}"
    return ev


class StatusBody(BaseModel):
    status: str
    note: str = ""
    actor: str = "operator"


@app.patch("/api/events/{event_id}/status")
def update_event_status(event_id: str, body: StatusBody):
    valid = {"open", "acknowledged", "verified", "assigned", "in_repair",
             "resolved", "dismissed"}
    if body.status not in valid:
        raise HTTPException(400, "invalid status")
    row = _db.execute("SELECT * FROM events WHERE id=?",
                      (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "event not found")
    history = json.loads(row["history"]) or []
    history.append({"status": body.status, "actor": body.actor,
                    "ts": datetime.now().isoformat(timespec="seconds"),
                    "note": body.note})
    _db.execute("UPDATE events SET status=?, history=?, note=? WHERE id=?",
                (body.status, json.dumps(history), body.note, event_id))
    _db.commit()
    SIM._audit(body.actor, "status_change", event_id,
               f"→{body.status} ({body.note or '-'})")
    return _event_row_to_dict(
        _db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone())


@app.get("/api/evidence/{cls}")
def evidence_photo(cls: str):
    """Real-world reference photo for a defect class (Wikimedia Commons, CC)."""
    files = sorted((BASE / "evidence").glob(f"{cls}_*.jpg"))
    if not files:
        raise HTTPException(404, "no reference photo for this class")
    pick = files[int(time.time()) % len(files)]
    return FileResponse(pick, media_type="image/jpeg")


@app.get("/api/events/{event_id}/image")
def event_image(event_id: str):
    row = _db.execute("SELECT * FROM events WHERE id=?",
                      (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "event not found")
    path = _annotated_png(row["frame_id"])
    return FileResponse(path, media_type="image/png")


@app.get("/api/frames/{frame_id}")
def raw_frame(frame_id: str):
    idx = int(frame_id[1:])
    img, _, _ = frames.get_frame(idx)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return Response(content=buf.tobytes(), media_type="image/jpeg")


@app.get("/api/frames/annotated/{frame_id}")
def annotated_frame(frame_id: str, force: bool = False):
    return FileResponse(_annotated_png(frame_id, force=force),
                        media_type="image/png")


@app.get("/api/frames/stage/{frame_id}/{stage}")
def stage_frame(frame_id: str, stage: str):
    return FileResponse(_stage_png(frame_id, stage), media_type="image/png")


@app.get("/api/vision/latest")
def vision_latest():
    if SIM.latest is None:
        raise HTTPException(404, "no frames processed yet")
    p = dict(SIM.latest)
    fid = p["frame_id"]
    p["urls"] = {
        "raw": f"/api/frames/{fid}",
        "annotated": f"/api/frames/annotated/{fid}",
        "stages": {s: f"/api/frames/stage/{fid}/{s}"
                   for s in ("raw", "preprocessed", "edges", "rails", "result")},
    }
    return p


@app.post("/api/vision/reanalyze/{frame_id}")
def vision_reanalyze(frame_id: str):
    idx = int(frame_id[1:])
    img, gt, _ = frames.get_frame(idx)
    res = vision.analyze(img, with_stages=True)
    res["frame_id"] = frame_id
    res["ground_truth"] = [g["class"] for g in gt]
    _annotated_png(frame_id, detections=res["detections"], force=True)
    res["annotated_url"] = f"/api/frames/annotated/{frame_id}?t={int(datetime.now().timestamp())}"
    return res


@app.post("/api/vision/analyze")
async def vision_upload(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "image too large (max 8 MB)")
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "could not decode image")
    img = cv2.resize(img, (640, 360), interpolation=cv2.INTER_AREA)
    res = vision.analyze(img)
    ann = vision.annotate(img, res["detections"], with_header=False)
    ok, buf = cv2.imencode(".jpg", ann, [cv2.IMWRITE_JPEG_QUALITY, 90])
    res["annotated"] = ("data:image/jpeg;base64,"
                        + base64.b64encode(buf.tobytes()).decode())
    res["note"] = ("Results are indicative — the prototype pipeline is tuned "
                   "for rover-camera track geometry (PRD §14).")
    return res


# -------------------------------------------------------------- analytics
@app.get("/api/analytics/summary")
def analytics_summary():
    open_events = _db.execute(
        "SELECT COUNT(*) FROM events WHERE status IN "
        "('open','acknowledged','verified','assigned','in_repair')"
    ).fetchone()[0]
    critical = _db.execute(
        "SELECT COUNT(*) FROM events WHERE severity='critical' AND status IN "
        "('open','acknowledged','verified','assigned','in_repair')"
    ).fetchone()[0]
    total14 = _db.execute(
        "SELECT COUNT(*) FROM events WHERE ts >= ?",
        ((datetime.now() - timedelta(days=14)).isoformat(),)).fetchone()[0]
    conf = _db.execute(
        "SELECT AVG(confidence) FROM events WHERE ts >= ?",
        ((datetime.now() - timedelta(days=14)).isoformat(),)).fetchone()[0]
    return {
        "inspected_today_km": SIM.mission["inspected_today_km"],
        "open_events": open_events,
        "critical_open": critical,
        "coverage_pct": round(min(100, SIM.mission["inspected_today_km"]
                                  / 18.0 * 100), 1),
        "events_14d": total14,
        "avg_confidence": round(conf or 0, 3),
        "active_rovers": 1,
        "captures": SIM.mission["captures"],
        "laps": SIM.mission["laps"],
    }


@app.get("/api/analytics/trend")
def analytics_trend(days: int = 14):
    days = min(30, max(1, days))
    start = datetime.now() - timedelta(days=days)
    rows = _db.execute("SELECT ts, class, severity FROM events WHERE ts >= ?",
                       (start.isoformat(),)).fetchall()
    buckets = {}
    for r in rows:
        d = r["ts"][:10]
        b = buckets.setdefault(d, {"by_class": {}, "by_severity": {},
                                   "total": 0})
        b["by_class"][r["class"]] = b["by_class"].get(r["class"], 0) + 1
        b["by_severity"][r["severity"]] = b["by_severity"].get(r["severity"], 0) + 1
        b["total"] += 1
    return {"series": [{"date": d, **v} for d, v in
                       sorted(buckets.items())]}


@app.get("/api/analytics/by-class")
def analytics_by_class():
    rows = _db.execute("SELECT class, COUNT(*) n FROM events GROUP BY class"
                       ).fetchall()
    return {"data": [{"class": r["class"], "count": r["n"]} for r in rows]}


@app.get("/api/analytics/by-severity")
def analytics_by_severity():
    rows = _db.execute(
        "SELECT severity, COUNT(*) n FROM events GROUP BY severity").fetchall()
    return {"data": [{"severity": r["severity"], "count": r["n"]} for r in rows]}


@app.get("/api/analytics/zones")
def analytics_zones():
    out = []
    for z in TRACK.zones:
        total = _db.execute("SELECT COUNT(*) FROM events WHERE zone=?",
                            (z["name"],)).fetchone()[0]
        open_ = _db.execute(
            "SELECT COUNT(*) FROM events WHERE zone=? AND status IN "
            "('open','acknowledged','verified','assigned','in_repair')",
            (z["name"],)).fetchone()[0]
        health = max(0, 100 - open_ * 6 - total * 0.4)
        out.append({"zone": z["name"], "events_total": total,
                    "events_open": open_, "health": round(health, 1),
                    "start_m": z["start_m"], "end_m": z["end_m"]})
    return {"data": out}


@app.get("/api/analytics/model")
def analytics_model():
    """Per-class metrics measured on the synthetic labelled set (PRD §17.2)."""
    if METRICS_PATH.exists():
        return json.loads(METRICS_PATH.read_text())
    return {"per_class": [], "measured_on": "synthetic labelled set",
            "note": "metrics pending — run backend/measure_model.py"}


@app.get("/api/audit")
def audit(limit: int = Query(100, le=500)):
    rows = _db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?",
                       (limit,)).fetchall()
    return {"entries": [dict(r) for r in rows]}


@app.get("/api/stream")
async def stream():
    async def gen():
        # replay recent events first, then live
        for msg in list(SIM.ring):
            yield f"data: {json.dumps(msg)}\n\n"
        yield f"data: {json.dumps({'type': 'hello', 'payload': {}})}\n\n"
        while True:
            try:
                msg = await asyncio.wait_for(SIM.queue.get(), timeout=25.0)
                yield f"data: {json.dumps(msg)}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


# ---------------------------------------------------------- client errors
class ClientError(BaseModel):
    kind: str = "error"
    text: str = ""
    detail: str = ""


@app.post("/api/client-error")
def client_error(body: ClientError):
    with open("/tmp/iris_client_errors.log", "a") as f:
        f.write(f"[{datetime.now().isoformat(timespec='seconds')}] "
                f"{body.kind}: {body.text}\n{body.detail}\n---\n")
    return {"ok": True}


# ---------------------------------------------------------------- SPA host
@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404)
    # serve real static assets (js/css/…) if present, else the SPA index
    if full_path:
        candidate = (FRONTEND_DIST / full_path).resolve()
        if (candidate.is_file()
                and str(candidate).startswith(str(FRONTEND_DIST.resolve()))):
            return FileResponse(candidate)
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        # never let a stale cached index.html point at a deleted hashed bundle
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    return JSONResponse({
        "service": "IRIS API",
        "hint": "Frontend build not found — run `npm run build` in /frontend, "
                "or use the Vite dev server (npm run dev) with the /api proxy.",
        "docs": "/docs"}, status_code=200)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
