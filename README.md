# IRIS — Intelligent Railtrack Inspection System

A rover-mounted, AI-assisted railway track inspection platform. IRIS detects,
localizes, fuses, prioritizes and tracks rail defects through a full
closed loop: rover camera → edge vision (OpenCV) → sensor fusion → risk
scoring → monitoring dashboard → human verification.

Full product specification: **[PRD.md](PRD.md)**

---

## The working demo

The demo runs the **complete pipeline without hardware** (PRD FR-711):

1. A simulated rover (IRIS-R1) patrols the Ghat Section of a real corridor
   (Mumbai–Pune) on the track geometry — GNSS + odometry, battery, signal.
2. Every 200 m it captures a **synthetic rover-camera frame** (perspective
   rails, sleepers, ballast — with injected ground-truth defects).
3. The frame runs through the **real OpenCV pipeline**: rail extraction →
   crack / broken-rail / fastener / foreign-object / vegetation detectors →
   confidence + bounding boxes.
4. Detections are fused with vibration + position evidence (PRD §15.1),
   scored for risk (§15.2), **deduplicated** into inspection events, and
   localized to exact chainage + coordinates.
5. Events stream to the dashboard over SSE — map pins, alerts, evidence
   images, and a full verify→resolve workflow.

## Quick start

```bash
# 1 · backend (FastAPI + OpenCV) — first run installs deps
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2 · frontend (React + Vite) — first run installs deps
cd ../frontend
npm install
npm run build        # once — the backend serves the built app
# OR for development with hot reload:
npm run dev          # http://localhost:5173 (proxies /api → :8000)
```

Then open **http://localhost:8000** (or :5173 in dev).

One-command convenience: `./start.sh` (starts backend, then the Vite dev server).

## Pages

| Route | What it does |
|---|---|
| `/` | Landing — 3D rail corridor with the rover, product story |
| `/dashboard` | Command overview — KPIs, mini live map, detections feed, zone health |
| `/map` | **Mission Map** — full interactive map: GPS track, live rover marker, severity pins, layer toggles, live event ticker, telemetry panel |
| `/vision` | **Vision Lab** — live annotated frame, pipeline stage strip (raw → CLAHE → edges → rails → detections), re-analyze, upload your own image, measured model metrics |
| `/defects` | Defect Registry — filterable events, evidence drawer, workflow actions (acknowledge → verify → assign → resolve) |
| `/analytics` | Trends by class & severity, zone health, chart/table toggle |
| `/fleet` | Rover fleet — live telemetry, mission controls, guarded safe-stop |

## The vision pipeline (backend/vision.py)

```
raw frame → CLAHE → rail extraction (column-support voting on the raw frame)
         → per-class detectors:
             broken_rail      rail-centreline dark-run profile
             surface_crack    dark stroke crossing the rail (geometry test)
             missing_fastener sleeper-band clip asymmetry
             foreign_object   high-saturation blob between rails
             vegetation       green-hue blob on the rail envelope
         → confidence floors · NMS · cross-class arbitration
```

Measured per-class metrics on the synthetic labelled set live at
`GET /api/analytics/model` (re-run with `backend/measure_model.py`).

## Layout

```
backend/   FastAPI app · track geometry · frame generator · vision pipeline
           · rover simulator · seeded 14-day history · SQLite
frontend/  React + Vite · Three.js/R3F 3D scenes · Framer Motion morph
           transitions · Leaflet maps · Recharts analytics
PRD.md     Product Requirements Document
```

## Key APIs

`/api/track` · `/api/rovers` · `/api/events` · `/api/events/{id}/status`
· `/api/vision/latest` · `/api/vision/analyze` (upload) ·
`/api/frames/{id}` (+ `/annotated`, `/stage/{stage}`) ·
`/api/analytics/*` · `/api/stream` (SSE) · interactive docs at `/docs`

## Honesty note

IRIS is an **inspection decision-support prototype** (PRD §2.1): detections
are evidence with confidence, always subject to human verification. The
synthetic frame generator + labelled set exist so detection quality is
*measured*, not claimed.
