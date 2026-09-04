# IRIS — Intelligent Railtrack Inspection System
## Product Requirements Document

| Field | Value |
|---|---|
| **Product name** | IRIS |
| **Document type** | Product Requirements Document (PRD) |
| **Version** | 1.0 |
| **Date** | 21 August 2026 |
| **Status** | Draft — for review |
| **Owner** | Product Team · 6 BITS |
| **Audience** | Engineering, Design, QA, Product, Project stakeholders |

---

## Table of Contents

1. [Document Control](#1-document-control)
2. [Executive Summary](#2-executive-summary)
3. [Product Vision & Guiding Principles](#3-product-vision--guiding-principles)
4. [Problem Statement](#4-problem-statement)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [Stakeholders & Personas](#6-stakeholders--personas)
7. [Scope](#7-scope)
8. [Terminology](#8-terminology)
9. [System Overview & Architecture](#9-system-overview--architecture)
10. [Functional Requirements](#10-functional-requirements)
11. [Data Model](#11-data-model)
12. [API Specification](#12-api-specification)
13. [UI/UX & Design System](#13-uiux--design-system)
14. [Vision Pipeline Technical Specification](#14-vision-pipeline-technical-specification)
15. [Sensor Fusion & Risk Formulae](#15-sensor-fusion--risk-formulae)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Testing & Validation Strategy](#17-testing--validation-strategy)
18. [Release Plan & Milestones](#18-release-plan--milestones)
19. [Risks & Mitigations](#19-risks--mitigations)
20. [Assumptions & Open Questions](#20-assumptions--open-questions)
21. [Appendices](#21-appendices)

---

## 1. Document Control

| Version | Date | Author | Change summary |
|---|---|---|---|
| 0.1 | 2026-07-28 | Product Team | Initial draft — problem framing, architecture outline |
| 0.9 | 2026-08-14 | Product Team | Added fusion/risk formulae, event schema, demo flow |
| 1.0 | 2026-08-21 | Product Team | Full PRD: FRs, data model, API, design system, validation plan |

**Review & approval:** Engineering lead, Design lead, QA lead, Product owner.

---

## 2. Executive Summary

IRIS (**I**ntelligent **R**ailtrack **I**nspection **S**ystem) is a rover-mounted, multi-sensor inspection platform that turns manual, periodic railway track inspection into continuous, data-driven condition assessment.

A wheeled inspection rover travels along the track carrying cameras, an IMU/vibration sensor suite, GNSS and wheel odometry. An on-board edge computer runs the vision pipeline (OpenCV + a trained detection model) and fuses visual, vibration and positional evidence into a **risk score per track segment**. Every detection is localized onto the railway track (GNSS + odometry + track map, reported with an uncertainty estimate), stored as a structured, traceable **inspection event**, and streamed to a centralized **monitoring dashboard** where maintenance teams see the exact location, evidence imagery, severity, risk, and history — and can act on it through a full detect → verify → prioritize → assign → resolve workflow.

**IRIS in one sentence:** *A rover-based, multimodal inspection platform that uses edge AI and sensor fusion to detect, localize, prioritize, and track railway anomalies for faster and more informed maintenance decisions.*

**Five words that define the product:** **Detect. Localize. Fuse. Prioritize. Track.**

### 2.1 What the product is — and is not

| IRIS is… | IRIS is not… |
|---|---|
| An **inspection decision-support** platform | A replacement for statutory/manual inspection or certified procedures |
| A **risk-estimation and trend-analysis** tool | A guaranteed failure-prediction system (no exact failure dates) |
| An **assisted / semi-autonomous** inspection rover | A fully autonomous safety-certified vehicle (unless field-validated) |
| An **augmentation layer** that prioritizes engineer attention | An autonomous authority making safety-critical decisions |

> **Product principle (binding):** the AI output is *evidence with confidence*, always subject to human verification. All product copy, UI labels, and demo scripts must reflect this framing. Claims such as "100% accurate", "predicts exact failure dates", "replaces manual inspection", "GPS gives centimeter-level localization", or "AI makes safety decisions autonomously" are **prohibited** in any shipped surface.

### 2.2 The core value loop

The innovation of IRIS is not any single algorithm — it is the **closed loop**:

> **Observation** (rover sensing) → **Evidence** (time-synchronized visual + vibration + position) → **Interpretation** (edge AI + fusion + risk score) → **Localization** (track segment + coordinates + uncertainty) → **Prioritized action** (dashboard queue → human verification → maintenance) → **Longitudinal learning** (recurrence and trend analysis feeding future prioritization).

A standalone crack detector does not provide this loop; IRIS does.

---

## 3. Product Vision & Guiding Principles

### 3.1 Vision

To make railway track inspection **continuous, contextual, and actionable** — so that small anomalies are found early, localized precisely, prioritized by risk, and tracked over time — while human engineering expertise is focused where it matters most.

### 3.2 Guiding principles (all requirements derive from these)

| # | Principle | Consequence for the product |
|---|---|---|
| P1 | **Decision support, not replacement** | Every detection is evidence; humans verify and decide. UI always shows confidence + source of each signal. |
| P2 | **Edge-first** | Detection runs on the rover; the dashboard receives filtered, structured events — not raw video streams. Works with intermittent connectivity. |
| P3 | **One physical defect = one event** | Detections are clustered by track position and time so a single crack never produces 100 alerts. |
| P4 | **Evidence, not assertions** | Every event carries image proof, sensor summary, confidence, and localization uncertainty. |
| P5 | **Risk is documented, versioned, and calibrated** | The fusion and risk formulae are explicit (Section 15), versioned in code, and tuned only on validation data — never arbitrary weights. |
| P6 | **Fail-safe by design** | Localization/sensing/compute degradation → degraded-mode event flags + safe-stop states; never silent bad data. |
| P7 | **Premium, calm operator experience** | The dashboard must feel trustworthy and premium (light pastel, 3D-interactive, motion-designed) — because operators act on it for hours. |
| P8 | **Traceability** | Every event is immutable, auditable, and linked to its frame, sensors, rover, segment, and human workflow history. |

---

## 4. Problem Statement

Railway track defects are small at first, hard to detect consistently, and costly — sometimes dangerous — when discovered late. Today's inspection workflow has four structural problems:

| Problem | What it costs | How IRIS addresses it |
|---|---|---|
| **Manual, labor-intensive inspection** | Significant time and manpower per kilometer; coverage is periodic, not continuous | Rover automates repetitive data collection on a repeatable route; humans keep final decisions |
| **Small defects grow silently** | Early-stage cracks, missing fasteners, and joint anomalies progress into critical failures | Computer vision detects visible anomalies early; vibration/IMU adds an independent evidence channel |
| **Fragmented inspection data** | Records spread across logs, paper, and silos — trend analysis is nearly impossible | One structured record per event: timestamp, segment, location, sensor data, image evidence, confidence, severity, history |
| **Reactive maintenance** | Issues surface only after deterioration is significant | Historical records enable recurrence detection, trend analysis, and risk-prioritized maintenance queues |

---

## 5. Goals & Success Metrics

### 5.1 Product goals

| # | Goal | Timeframe |
|---|---|---|
| G1 | Automate repetitive visual + vibration inspection via rover | MVP |
| G2 | Detect, classify, and localize the prototype defect taxonomy (Section 14.2) | MVP |
| G3 | Deliver every detection as a localized, prioritized, verifiable event on the dashboard | MVP |
| G4 | Provide longitudinal trend/recurrence views per track segment | MVP |
| G5 | Validate with a rail-specific dataset + controlled field trial; report honest metrics | Post-MVP |

### 5.2 Success metrics

| Category | Metric | MVP target (prototype) | Validation method |
|---|---|---|---|
| Vision | Precision / Recall / F1 per defect class | To be measured on held-out set; report honestly, target F1 ≥ 0.75 on synthetic + collected set | Confusion matrix on validation split |
| Vision | Inference latency per frame (edge) | ≤ 150 ms on Jetson-class hardware | Benchmarks |
| Localization | Median / p90 position error along track | Median ≤ 5 m, p90 ≤ 10 m (prototype, GNSS + odometry) | Ground-truth marker trials |
| End-to-end | Event creation latency (frame capture → dashboard alert) | ≤ 5 s (live mode) | Instrumented runs |
| End-to-end | Duplicate-event rate | ≤ 5% (one physical defect → one event) | Review of clustered events |
| End-to-end | False-alert rate (operator-confirmed) | Measured and reported per class | Operator verification log |
| Operational | Track coverage per mission | 100% of assigned route logged with evidence | Mission reports |
| Operational | Inspection time saved vs manual walk | Estimated from mission logs; reported as comparison, not promise | Field trial |

> **Honesty rule (from the guiding principles):** any metric not yet measured is reported as a *planned validation metric*, never invented.

---

## 6. Stakeholders & Personas

| Persona | Role | Primary needs | Key dashboard surface |
|---|---|---|---|
| **Track Engineer** (primary) | Reviews detections, decides maintenance action | Trustworthy evidence, exact location, severity/risk, history of the segment | Defect Registry, Mission Map |
| **Maintenance Planner** | Schedules crews and resources | Prioritized queue, zone-level health, trend/recurrence | Analytics, Defect Registry |
| **Inspection Operator** | Runs rover missions | Mission status, rover health, live feed, safe-stop controls | Fleet, Mission Map |
| **Zone/Safety Supervisor** | Oversight, escalation | Critical alerts first, audit trail, degraded-mode flags | Dashboard, Alerts |
| **Data/ML Engineer** | Maintains pipeline quality | Per-class model metrics, image-quality stats, dataset feedback loop | Analytics (ML view), Vision Lab |
| **Admin** | Access control, audit | Role management, audit logs, system health | Settings, Audit |

---

## 7. Scope

### 7.1 In scope (MVP / prototype stage)

- Wheeled inspection rover platform (assisted operation, E-stop, geofence, watchdog)
- Camera + IMU/vibration + GNSS + wheel-odometry acquisition with a **common time base**
- Edge vision pipeline: classical OpenCV stages + trained detection model (YOLO-family), post-processing, deduplication
- Localization: GNSS + odometry + track-map projection → chainage, coordinates, uncertainty
- Sensor fusion and risk scoring (Section 15)
- Backend platform (FastAPI + database) with event storage, APIs, live streaming, auth, audit
- Monitoring dashboard (React) — full page set in Section 10.8, including live monitoring map, Vision Lab, Defect Registry, Analytics, Fleet
- Human verification workflow: open → verified → assigned → in-repair → resolved (with dismiss)
- Offline buffering on the rover + resync
- Fail-safe states and degraded-mode event flags

### 7.2 Out of scope (prototype stage — explicitly deferred)

- Railway-safety **certification** and deployment on operational railway property
- Fully autonomous navigation (obstacle avoidance in public areas, certified autonomy stack)
- Centimeter-grade positioning (RTK/INS-grade) — prototype targets meter-grade
- Exact failure-date prediction (the product estimates risk and trend only)
- Replacement of statutory inspection procedures
- Multi-rover fleet orchestration beyond basic fleet status (deferred to post-MVP)
- Training on large diverse rail datasets (planned; prototype ships with synthetic + collected sample data)

### 7.3 Future (post-MVP)

- Beacons/markers or RTK for sub-meter localization
- Predictive-maintenance module validated on longitudinal field data
- Video-clip evidence (vs. still frames)
- Mobile companion app for field crews
- Multi-zone, multi-rover deployment with centralized model version management

---

## 8. Terminology

| Term | Definition |
|---|---|
| **Chainage** | Distance in meters along the track polyline from a defined origin (route milepost) |
| **Track segment** | A uniquely identified portion of track (e.g., `S-104`), the unit of risk scoring and history |
| **Inspection event** | One structured record of one physical defect: location, time, class, confidence, severity, risk, evidence, status |
| **Frame** | One camera capture with timestamp + rover position at capture |
| **Detection** | Raw model output (class + bounding box + confidence) on one frame — pre-clustering |
| **Fusion score** | Combined evidence score from visual + vibration + position consistency (Section 15.1) |
| **Risk score** | Prioritization score combining severity, confidence, recurrence, trend, operational context (Section 15.2) |
| **Degraded mode** | Operating state when image quality, localization, or compute health drops below threshold → events are flagged, operator alerted |
| **Safe stop** | Rover halts and holds, awaiting operator instruction (triggered by geofence breach, E-stop, watchdog, health failure) |
| **Zone** | Operational subdivision of a route (e.g., station pair or ghat section) used for health rollups |
| **Duplicate-event suppression** | Clustering detections by track position (± window) and time so one physical defect yields one event |

---

## 9. System Overview & Architecture

IRIS is a **seven-layer pipeline**. The conceptual flow is always:

> **Physical observation → digital data → AI interpretation → risk decision → maintenance action**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             IRIS — SYSTEM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────── ROVER PLATFORM ──────────────────────────┐ │
│  │  Cameras        IMU / Vibration      GNSS       Wheel Odometry          │ │
│  │      │                │                │              │                 │ │
│  │      └────────────────┴────────────────┴──────────────┘                 │ │
│  │                        ▼                                                │ │
│  │  ┌────────── Microcontroller ──────────┐   deterministic acquisition,  │ │
│  │  │  ADC reads, timestamps, E-stop,     │   watchdog, motor control     │ │
│  │  └──────────────┬──────────────────────┘                               │ │
│  │                 ▼                                                       │ │
│  │  ┌────────── Edge Computer (Jetson-class) ─┐                            │ │
│  │  │  L1–L5: preprocess → OpenCV → YOLO →    │                            │ │
│  │  │  fusion → risk → localization → dedup   │  offline buffer           │ │
│  │  └──────────────┬──────────────────────────┘                            │ │
│  └─────────────────┼────────────────────────────────────────────────────────┘ │
│                    ▼  (structured events + thumbnails; not raw video)        │
│  ┌────────────────────────── DATA PLATFORM (L6) ──────────────────────────┐ │
│  │  FastAPI backend · SQLite (dev) / PostgreSQL (prod)                    │ │
│  │  Event store · evidence storage · auth/RBAC · audit log                │ │
│  │  REST APIs · SSE live stream · analytics aggregation                   │ │
│  └──────────────┬──────────────────────────────────────────────────────────┘ │
│                 ▼                                                            │
│  ┌────────────────────────── MONITORING DASHBOARD (L7) ───────────────────┐ │
│  │  React SPA — live map · alerts · defect queue · evidence · trends      │ │
│  │  Human verification workflow → maintenance action                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.1 The seven layers

| Layer | Name | Responsibility | Key components |
|---|---|---|---|
| L1 | Rover hardware | Physical platform moving along the inspection zone | Wheeled rover, camera, IMU/vibration sensor, GNSS, encoders, E-stop, geofence, battery + charging dock |
| L2 | Data acquisition & synchronization | Every measurement gets a timestamp + track reference | Common clock (NTP-offset corrected), frame ↔ IMU window ↔ position alignment ≤ 50 ms |
| L3 | Computer vision | Find visible anomalies | OpenCV pre-processing + ROI, YOLO-family detector, confidence thresholding, NMS, class filtering |
| L4 | Sensor fusion | Each modality contributes evidence; no naive averaging | Weighted evidence fusion (Section 15.1), time-aligned signals |
| L5 | Risk & prediction | Severity, confidence, recurrence, trend, context → risk | Risk formula (Section 15.2), per-segment trend states (stable / degrading / recurring) |
| L6 | Data platform | Store, serve, secure events | FastAPI, database, evidence storage, REST + SSE, RBAC, audit |
| L7 | Monitoring dashboard | Operational view → human action | React SPA: map, alerts, queue, history, trends, verification workflow |

### 9.2 Technology stack (prototype)

| Domain | Choice | Rationale |
|---|---|---|
| Frontend | **React (Vite)** | Responsive operator dashboard, fast iteration |
| 3D & motion | **Three.js / React Three Fiber + Framer Motion** | 3D-interactive scenes, morphing page transitions |
| Map | **Leaflet + light basemap (Carto Positron-style tiles)** | Free, no API key, matches the light pastel theme |
| Charts | **Recharts** | Declarative, consistent with the design system |
| Backend | **FastAPI (Python)** | Native integration with the ML/OpenCV layer, async streaming |
| Vision | **Python + OpenCV (+ NumPy)** | Pre-processing, ROI, classical CV stages; YOLO-family model for learned detection |
| Edge compute | **Jetson-class board** (e.g., Orin Nano) | YOLO inference at the edge |
| Acquisition MCU | **ESP32/RP2040-class microcontroller** | Deterministic sensor reads + motor control + watchdog (NOT the YOLO engine) |
| Positioning | GNSS + IMU + wheel odometry + track map | Multi-source, track-constrained localization |
| Database | **SQLite** (dev) → **PostgreSQL** (prod) | Event + time-series storage, traceability |
| Live transport | SSE (REST polling fallback) | Simple, reliable, auto-reconnect for dashboard live view |
| Auth | JWT + role-based access control | Operator / engineer / supervisor / admin |

> **Architecture correction (carried into implementation):** the microcontroller handles acquisition and control; OpenCV + YOLO inference runs on the edge computer. The materials must never imply full YOLO inference on the microcontroller.

### 9.3 Data transmission strategy

Edge-first filtering, to keep bandwidth low and offline capability high:

- Continuous raw video stays **on the rover** (buffered, ring-limited).
- Only **structured events + evidence thumbnails** (downscaled JPEG) are transmitted live.
- Full-resolution evidence uploads happen opportunistically (on demand or on reconnect).
- The rover buffers events when offline and syncs when connectivity returns.

---

## 10. Functional Requirements

Priority legend: **P0** = must ship in MVP · **P1** = should ship in MVP · **P2** = post-MVP.

### 10.1 F-100 · Rover Platform & Acquisition (L1)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-101 | The rover shall traverse the inspection route at a controlled speed (prototype target 1–3 m/s) in **assisted** mode (operator supervises; E-stop always live). | P0 | Rover completes a route run; E-stop halts motion within 1 s in test |
| FR-102 | The rover shall capture a continuous front-facing camera stream of the track (rails, sleepers, fasteners, joints, surroundings). | P0 | ≥ 15 fps at 640×360+; frames time-stamped |
| FR-103 | The rover shall sample IMU + vibration (accelerometer z-axis) continuously during motion. | P0 | ≥ 100 Hz sampling; windows time-stamped |
| FR-104 | The rover shall report position from GNSS + wheel odometry (+ IMU dead-reckoning between fixes). | P0 | Position updates ≥ 1 Hz; each carries uncertainty estimate |
| FR-105 | A microcontroller shall own deterministic acquisition (ADC reads, encoder counts, motor control) and a hardware watchdog. | P0 | MCU failures trigger safe stop |
| FR-106 | An edge computer shall run the vision/fusion pipeline and the offline event buffer. | P0 | Pipeline runs while MCU is isolated |
| FR-107 | The rover shall support **geofence** (route bounds), **E-stop**, and **safe-stop** states. | P0 | Breach/E-stop/watchdog → motors disabled, state broadcast |
| FR-108 | The rover shall monitor its own health: battery, temperature, storage, signal quality, sensor health. | P1 | Health metrics streamed with telemetry |
| FR-109 | The rover shall run startup self-checks (camera exposure, IMU calibration sanity, GNSS fix, storage). | P1 | Startup report visible on dashboard |

### 10.2 F-200 · Data Acquisition & Time Synchronization (L2)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-201 | All measurements share one clock domain: camera frames, IMU/vibration windows, and positions are timestamped with a common time base. | P0 | Sync error ≤ 50 ms in test logs |
| FR-202 | Every frame shall be linked to the rover position at capture time (interpolated from position stream). | P0 | Frame → position lookup resolves within ≤ 1 m of reported position |
| FR-203 | Vibration windows shall be aligned to frames by timestamp for fusion. | P0 | Alignment error ≤ 50 ms |
| FR-204 | Acquisition shall degrade gracefully: missing sensor → event flag `sensor_degraded`, pipeline continues with reduced fusion weight (never silently assumes data). | P0 | Simulated sensor dropout produces flagged events |

### 10.3 F-300 · Computer Vision (L3)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-301 | Pre-processing: resize, denoise, exposure/illumination handling, and crop to track region of interest (ROI). | P0 | Pipeline output quality documented per stage (Section 14.1) |
| FR-302 | The detector shall detect and classify the **prototype defect taxonomy**: surface crack, broken rail / rail gap, missing or damaged fastener, joint anomaly, foreign object, vegetation overgrowth. | P0 | Per-class detection demonstrated on synthetic + collected sample frames |
| FR-303 | Post-processing: confidence thresholding, non-maximum suppression, class filtering, duplicate-frame handling. | P0 | No duplicate boxes on a single frame; detections carry confidence |
| FR-304 | The classical OpenCV pipeline (edge/line/contour analysis) shall run on the edge device and is the baseline for geometric anomalies (rail continuity, gap, crack candidates). | P0 | Pipeline specified in Section 14, reproducible |
| FR-305 | A trained YOLO-family detector shall augment classical CV for learned classes (fastener, foreign object, joint anomaly). | P1 | Model card: dataset, mAP, per-class recall, latency |
| FR-306 | Image-quality monitoring: blur, brightness, obstruction, entropy. If quality < threshold → frame marked **degraded**, operator alerted, AI result not trusted silently. | P0 | Dirty-lens simulation → degraded flag + alert |
| FR-307 | Vision outputs: class, bounding box/segmentation, confidence, frame ID, timestamp, location reference. | P0 | Output schema matches Section 11 |

### 10.4 F-400 · Localization & Geo-Mapping (L4-adjacent)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-401 | Rover position = fusion of GNSS + wheel odometry + IMU dead-reckoning, **projected onto the track polyline** (snap-to-track). | P0 | Positions always on track geometry |
| FR-402 | Every position reports **chainage** (m along route) + lat/lng + **uncertainty estimate** (m). | P0 | Uncertainty visible in UI |
| FR-403 | Defect geo-location: rover position + camera look-ahead offset along track (from camera pitch/height) + lateral offset estimated from bounding-box position in frame. | P0 | Defect pins land on the track within the uncertainty budget (Section 5.2) |
| FR-404 | The track map shall be stored as a polyline with stations, zones, and segment IDs; defect chainage ↔ coordinates conversions both ways. | P0 | Round-trip conversion test passes |
| FR-405 | Positioning health monitoring: GNSS fix quality, odometry slip, IMU drift → degradation flags + safe stop when unreliable. | P0 | Simulated GNSS loss → flagged event, position continues via dead-reckoning with growing uncertainty |
| FR-406 | Track-referenced markers/beacons shall be an installable enhancement for sub-meter accuracy (post-MVP). | P2 | — |

### 10.5 F-500 · Sensor Fusion (L4)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-501 | Fusion combines **visual score**, **vibration score**, and **position consistency** per the formula in Section 15.1. | P0 | Formula implemented, weights configurable + versioned |
| FR-502 | A visual candidate + abnormal vibration at the same location/time raises combined evidence vs. either alone. | P0 | Unit test with synthetic signals demonstrates the interaction |
| FR-503 | Missing/flagged sensor data reduces that channel's weight and is recorded in the event's sensor summary. | P0 | Event shows which modalities contributed |
| FR-504 | Fusion weights shall be calibrated on validation data; changing weights requires a new formula version. | P1 | Weights versioned in repo |

### 10.6 F-600 · Risk Scoring & Trend Analysis (L5)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-601 | Severity assignment from defect class + calibrated rules (Section 14.2). | P0 | Severity shown on every event |
| FR-602 | Risk score combines severity, confidence, recurrence, trend, operational context (Section 15.2). | P0 | Formula documented, versioned, unit-tested |
| FR-603 | Recurrence check: events near the same chainage within a time window raise risk. | P0 | Repeat detections at one segment visibly escalate |
| FR-604 | Segment trend state: stable / degrading / recurring, from historical events. | P1 | Trend shown per segment; no failure-date claims |
| FR-605 | All risk outputs are framed as *estimation*, not prediction; UI copy follows P1. | P0 | Copy review gate |

### 10.7 F-700 · Data Platform / Backend (L6)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-701 | Store inspection events with the full schema of Section 11. | P0 | CRUD + query verified |
| FR-702 | REST APIs for events, rovers, missions, track, zones, analytics, vision. | P0 | Spec in Section 12 |
| FR-703 | Live telemetry + event stream to the dashboard (SSE with REST polling fallback). | P0 | New event appears on dashboard ≤ 2 s after API receipt |
| FR-704 | **Duplicate-event suppression**: cluster detections by chainage window (±2 m prototype) + time window; one physical defect → one event with multiple supporting frames. | P0 | Synthetic multi-frame burst → 1 event, N frames attached |
| FR-705 | Evidence storage: thumbnails + full frames, referenced from events. | P0 | Event detail shows evidence image |
| FR-706 | Event workflow state machine: `open → acknowledged → verified → assigned → in_repair → resolved` (+ `dismissed`). State changes logged with actor + timestamp. | P0 | Workflow operable from dashboard |
| FR-707 | AuthN/AuthZ: JWT + roles (operator, engineer, supervisor, admin); least privilege. | P1 | Unauthorized API calls rejected; audit entries written |
| FR-708 | Audit log for every mutation (who, what, when). | P1 | Audit UI for admin |
| FR-709 | Rover offline sync: accept buffered event batches with original timestamps; no data loss on reconnect. | P1 | Simulated disconnect/reconnect preserves all events |
| FR-710 | Zone and segment health aggregation APIs for the dashboard/analytics. | P0 | Aggregates match stored events |
| FR-711 | Simulation mode: a software rover simulator (GPS track playback + synthetic camera frames + synthetic vibration) drives the full pipeline end-to-end without hardware. | P0 | Demo + CI can run the complete loop on a laptop |

### 10.8 F-800 · Monitoring Dashboard (L7)

The dashboard is the **decision layer** — an engineer verifies evidence and decides actions. All pages follow the design system in Section 13.

| ID | Page | Key requirements | Priority |
|---|---|---|---|
| FR-801 | **Home / Landing** | Product story in ≤ 3 scrolls; hero 3D scene (stylized rail corridor + rover, interactive parallax); "Open Dashboard" CTA; feature cards (Detect · Localize · Fuse · Prioritize · Track); calm pastel aesthetic. | P0 |
| FR-802 | **Overview Dashboard** | KPI tiles: track inspected today (km), open defects, critical alerts, coverage %, fleet status; mini live map; latest detections feed; rover status strip; alert banner on degraded modes. Auto-refresh ≤ 3 s. | P0 |
| FR-803 | **Mission Map (Monitoring Map)** | Full interactive map: track polyline with zone shading, animated rover marker (live GNSS track), defect pins colored by severity with popup (class, confidence, chainage, age); layer toggles (defects by severity, rover track, zones, stations); click pin → event drawer; live event ticker; rover telemetry panel (speed, battery, signal, position uncertainty). | P0 |
| FR-804 | **Vision Lab** | Live camera frame with detection overlays (bounding boxes + class + confidence); pipeline stage strip (raw → preprocessed → edge/ROI → detections); per-frame detection list; "Re-analyze" button (re-run pipeline on the frame); image upload → run the OpenCV pipeline on a user image and show results (demo of the vision stack); image-quality badge (degraded flag). | P0 |
| FR-805 | **Defect Registry** | Filterable list (class, severity, status, zone, date); severity badges with icon + label (never color alone); detail drawer: evidence image, sensor summary, map mini-embed, chainage, history timeline of workflow changes, actions: Acknowledge / Verify / Assign / Resolve / Dismiss (role-gated). | P0 |
| FR-806 | **Analytics** | Trend charts (events/day by class & severity), zone health bars, severity distribution, coverage % over time, fleet uptime, model metrics per class (precision/recall/F1), recurrence hotspots; time-range filter; table view for accessibility. | P0 |
| FR-807 | **Fleet** | Rover cards: live status, battery, speed, temperature, signal, mission progress, camera on/off; mission controls (Start / Pause / Resume / **Safe Stop** — prominent and guarded); health checklist per rover. | P0 |
| FR-808 | **Alerts** (integrated into Dashboard) | Critical alerts first; degraded-mode flags (image quality, localization, sensor health) prominently surfaced; acknowledge flow. | P0 |
| FR-809 | Global shell | Glass top navigation with animated active-pill; consistent layout across pages; morphing transitions between pages (Section 13.5); fully responsive (desktop-first, tablet + mobile usable). | P0 |

### 10.9 F-900 · Verification Workflow & Alerting

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-901 | Workflow states and transitions as in FR-706; UI enforces legal transitions; every change logged. | P0 | State machine unit + UI tests |
| FR-902 | Critical/high-severity events trigger dashboard alert + event-ticker entry immediately. | P0 | Latency ≤ 2 s from API receipt |
| FR-903 | Alerts carry: location, class, severity, confidence, age, evidence thumbnail, one-tap open. | P0 | Alert → event detail in ≤ 2 interactions |
| FR-904 | Degraded-mode alerts (image quality, localization, sensor health) are surfaced even when no defect is detected. | P0 | Simulated dirty lens → alert without detection |
| FR-905 | Dismissed events are retained for audit with reason + actor. | P0 | Dismiss reason stored and queryable |

### 10.10 F-1000 · Edge-First Operation & Fail-Safe

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-1001 | Detection + local buffering continue without connectivity; sync on reconnect (FR-709). | P1 | Simulated offline run → full data present after reconnect |
| FR-1002 | Safe-stop logic: geofence breach, E-stop, watchdog timeout, battery critical, localization unreliable → stop + notify. | P0 | Each trigger tested |
| FR-1003 | Fail-safe stance: AI outputs are evidence, never autonomous authority; critical actions always require human verification in the UI. | P0 | No UI path performs a maintenance action without human confirmation |
| FR-1004 | The rover buffers raw evidence locally (ring buffer) for on-demand full-quality retrieval. | P2 | — |

### 10.11 F-1100 · Security & Audit

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-1101 | Encrypted transport (HTTPS/WSS) for all rover ↔ backend ↔ dashboard traffic (self-signed acceptable in prototype, documented). | P1 | Traffic captured shows encryption |
| FR-1102 | Device authentication for rovers (per-device token); API auth for users. | P1 | Rejected without valid token |
| FR-1103 | Least-privilege RBAC; admin-only for user/rover management. | P1 | Role matrix tested |
| FR-1104 | Audit log (FR-708) immutable from the API surface. | P1 | No API endpoint mutates audit entries |
| FR-1105 | No secrets in frontend code; env-based configuration. | P0 | Secret scan clean |

---

## 11. Data Model

### 11.1 Core entities

| Entity | Key fields |
|---|---|
| **Rover** | rover_id, name, status (idle/mission/charging/offline/safe_stop), battery_%, speed_mps, temperature_c, signal_dbm, firmware_version, last_heartbeat |
| **Mission** | mission_id, rover_id, route_id, start/end time, chainage_start/end, distance_m, status, coverage_% |
| **Route / Track** | route_id, polyline (chainage-indexed lat/lng points), stations[], zones[] (chainage ranges), total_length_m |
| **Zone** | zone_id, route_id, name, chainage range, health_score |
| **Segment** | segment_id (e.g., `S-104`), zone_id, chainage range, last_inspected, trend_state |
| **Frame** | frame_id, rover_id, mission_id, timestamp, chainage_m, lat, lng, image_ref, quality_score, degraded_flag |
| **Detection** | detection_id, frame_id, class, bbox, confidence, model_version, sensor_summary |
| **Inspection Event** | see 11.2 (the primary record) |
| **VibrationWindow** | window_id, rover_id, timestamp range, rms, peak, spectral_centroid, anomaly_flag, anomaly_score |
| **User / Role** | user_id, role, name |
| **AuditEntry** | entry_id, actor, action, entity, timestamp, delta |

### 11.2 Inspection event schema (mandatory minimum)

```
event_id             UUID — one physical defect, one event
track_segment_id     e.g. S-104
route_id / zone_id
timestamp            capture time (common time base)
chainage_m           distance along track
lat, lng             snapped to track geometry
position_uncertainty_m
defect_class         surface_crack | broken_rail | missing_fastener |
                     joint_anomaly | foreign_object | vegetation
confidence           model/evidence confidence [0,1]
severity             low | medium | high | critical
fused_score          [0,1] evidence score (Section 15.1)
risk_score           [0,100] (Section 15.2)
recurrence_count     prior events near this chainage (window)
trend_state          stable | degrading | recurring
sensor_summary       {visual: {score, quality}, vibration: {score, rms, zcr},
                     position: {consistency, uncertainty_m}}
image_ref            evidence thumbnail + full frame refs (1..N supporting frames)
model_version        detector + formula versions
status               open | acknowledged | verified | assigned | in_repair |
                     resolved | dismissed
history              [{status_change, actor, timestamp, note}]
rover_id, mission_id
```

---

## 12. API Specification

Base: `/api/v1` · Auth: `Authorization: Bearer <JWT>` · Live: SSE at `/api/v1/stream`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service + DB health |
| GET | `/rovers` | Fleet status list |
| GET | `/rovers/{id}` | Rover detail + health |
| POST | `/rovers/{id}/command` | `{action: start | pause | resume | safe_stop}` (operator role) |
| GET | `/missions/current` | Active mission state (rover pos, chainage, progress, stats) |
| GET | `/track` | Route polyline, stations, zones, segments |
| GET | `/events` | List events — filters: class, severity, status, zone, date-range; pagination |
| GET | `/events/{id}` | Event detail incl. evidence refs + history |
| PATCH | `/events/{id}/status` | `{status, note}` — workflow transition (logged to audit) |
| GET | `/events/{id}/image` | Evidence thumbnail / annotated frame |
| GET | `/events?near={chainage}` | Recurrence context for a segment |
| GET | `/frames/{id}` | Raw / annotated frame image |
| GET | `/vision/latest` | Latest processed frame + detections |
| POST | `/vision/analyze` | Upload image → run pipeline → detections + annotated image |
| GET | `/analytics/summary` | KPI numbers for dashboard |
| GET | `/analytics/trend?days=` | Events/day by class & severity |
| GET | `/analytics/zones` | Per-zone health + defect counts |
| GET | `/analytics/model` | Per-class precision/recall/F1 (validation set) |
| GET | `/zones/{id}/segments` | Segment health + trend states |
| GET | `/stream` | SSE: `rover_telemetry`, `event_created`, `frame_processed`, `alert`, `health_flag` |
| GET | `/audit` | Audit entries (admin) |
| POST | `/sync/batch` | Rover offline batch upload (rover-scoped token) |

**Streaming contract:** SSE event payloads are JSON with `type` + `payload`; the frontend falls back to 2.5 s polling when SSE is unavailable. Events are idempotent (client dedupes by event_id).

---

## 13. UI/UX & Design System

> **Design intent:** IRIS operators watch this screen for hours. The interface must feel **premium, calm, and trustworthy** — a light, pastel, softly 3D world that communicates precision, not alarm fatigue. Every animation has a purpose; nothing spins gratuitously.

### 13.1 Visual identity

- **Mood:** airy, luminous, soft-glow "control room in daylight" — glass surfaces, gentle gradients, subtle grain.
- **Depth language:** soft shadows, glassmorphism cards, gentle 3D scenes (rail corridor + rover), layered parallax — never heavy skeuomorphism.
- **Brand:** IRIS logomark (stylized iris/aperture + rail motif), wordmark in display type.

### 13.2 Color tokens (light pastel)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#FAF9F7` | App background (warm off-white) |
| `surface` | `rgba(255,255,255,.72)` | Glass card fill (+ backdrop blur 14px, 1px light border) |
| `ink` | `#2E2A3B` | Primary text (deep plum-grey) |
| `ink-muted` | `#6B6780` | Secondary text |
| `mint` | `#7FD8BE` | Primary brand accent; positive status |
| `lavender` | `#A79CF0` | Secondary brand accent |
| `peach` | `#FFB997` | Warm accent; high severity |
| `sky` | `#8ECAE6` | Info; low severity |
| `butter` | `#FFD97D` | Medium severity; highlight |
| `rose` | `#F4A6C0` | Critical severity; danger |

**Severity system (status colors — reserved, never reused as chart series colors):**

| Severity | Color | Icon | Rule |
|---|---|---|---|
| Low | sky | `Info` | color **always** paired with icon + label |
| Medium | butter | `AlertTriangle` | same rule — color alone is never the sole encoder |
| High | peach | `AlertOctagon` | same rule |
| Critical | rose | `Siren/AlertCircle` | same rule + stronger visual treatment (pulse, priority slot) |

**Chart categorical order (fixed, never re-ordered by rank or filter):** lavender → mint → peach → sky → butter → rose. A series count beyond the palette folds into "Other" — no generated hues. Text on charts always wears ink tokens, never the series color; direct labels only on a select few marks, not every point; single-series charts need no legend (title names it), multi-series always get a legend.

### 13.3 Typography & layout

- **Display:** Sora (fallback: system sans) — page titles, hero, KPI numerals.
- **Body:** Inter/Outfit (fallback: system sans) — UI text, tables.
- **Scale:** KPI numerals 32–40px; page titles 28px; body 14–15px; captions 12px.
- **Layout:** 8px grid; content max-width 1440px; 24px page gutters; cards radius 22px; 4px chip radius.

### 13.4 Component language

| Component | Spec |
|---|---|
| Glass card | `surface` fill, 14px backdrop blur, 1px `rgba(255,255,255,.6)` border, soft layered shadow (0 12px 32px pastel-tinted), 22px radius, hover: lift 2px + shadow deepen |
| KPI tile | Numeric hero + delta chip + 40px sparkline; gentle count-up on load |
| Severity badge | Icon + label + pastel tint (see severity rule) |
| Buttons | Primary: ink-filled pill; Secondary: glass pill; Danger (Safe Stop): rose with confirmation modal + guard (hold-to-confirm on touch) |
| Data table | Zebra-free airy rows, 44px row height, sticky header, row hover tint |
| Nav | Glass top bar, active pill animated with a shared-layout morph; page tabs use the same mechanism |
| Alerts | Priority-ordered stack, critical-first, slide-in from top-right, auto-dismiss only for low |
| Empty/loading states | Skeleton shimmer in pastel; friendly empty states with illustration |

### 13.5 3D, motion & transitions (the "premium" layer)

| # | Requirement | Spec |
|---|---|---|
| M1 | **Morphing page transitions** | Route changes play a pastel SVG blob **shape-morph wipe** (path interpolation via Framer Motion `AnimatePresence`) + content fade/slide, total 500–700 ms; no flash of unstyled content; back/forward safe |
| M2 | **3D scenes** | Home hero: stylized rail corridor — track into the horizon, rover model (wheels, camera mast, solar panel), soft pastel sky, floating particles, gentle fog; interactive parallax on pointer; rover idles/patrols along the track with a scanning light cone |
| M3 | **Micro-interactions** | Count-up KPIs, springy hover lifts, animated active-pill, pin-drop animation on new map defects, pulsing critical pin, smooth camera fly-to on event click |
| M4 | **Live map motion** | Rover marker glides along the GPS track polyline (animated dash), track "inspection progress" grows as chainage advances; severity pins gently bob with a critical-only pulse |
| M5 | **Performance guardrails** | DPR cap [1,2]; 3D canvas paused when off-screen/tab hidden; 60 fps target on mid hardware; 3D never blocks first paint (lazy canvas) |
| M6 | **Reduced motion** | `prefers-reduced-motion` → transitions become 150 ms cross-fades, no parallax, no continuous 3D loops |

### 13.6 Accessibility (minimum bar)

- WCAG 2.1 AA contrast for all text on the light surface (ink/muted verified against `#FAF9F7`).
- Keyboard: full tab order, focus-visible rings, all workflow actions keyboard-operable.
- Map and charts always accompanied by list/table equivalents (a table view exists for every chart).
- Status never color-alone (icon + label always present).
- Screen-reader labels on KPI tiles, chart figures, and alert announcements (live region).

### 13.7 Responsive behavior

Desktop-first; tablet: 2-column collapse, map reflows; mobile: single column, map simplified (pins + list hybrid), nav collapses to sheet, Safe Stop remains reachable in ≤ 2 taps.

---

## 14. Vision Pipeline Technical Specification

### 14.1 Stage sequence

```
raw frame ──► pre-process ──► rail geometry extraction ──► per-class detectors ──► post-process
 640×360      resize, CLAHE,     Canny + HoughLinesP,        classical (crack, gap,  NMS, thresholding,
              denoise, ROI       rail polyline masks,        fastener) + YOLO        class filter, dedup
                                 perspective scaling         (object, joint)
```

1. **Pre-processing:** grayscale + CLAHE (clip 2.5), mild denoise, crop/weight to track ROI, illumination normalization.
2. **Rail extraction:** Canny(60,140) → HoughLinesP → cluster near-vertical lines into the two rails → per-rail polyline masks with perspective-scaled width. *This step is the geometric anchor for everything else.*
3. **Classical detectors:**
   - **Surface crack:** dark elongated contours inside rail mask (morph-open vertical kernel, area + aspect + solidity filters).
   - **Broken rail / gap:** column-wise intensity profile along each rail; contiguous low-intensity band → discontinuity.
   - **Missing fastener:** clip candidates (bright small blobs on sleeper bands); sleeper with count below baseline → missing fastener.
   - **Foreign object:** high-saturation/high-brightness blob between rails (HSV mask on low-saturation ballast background).
   - **Vegetation:** green-hue mask overlapping the rail envelope.
4. **YOLO detector** (learned classes — joint anomaly, fastener variants, generic foreign objects) runs in parallel; results merged with classical via NMS + class arbitration.
5. **Post-processing:** confidence threshold per class, NMS, per-frame dedup, then **cross-frame duplicate suppression** (Section 10.7) at the event layer.

### 14.2 Defect taxonomy & default severity

| Class | Primary modality | Support modality | Default severity |
|---|---|---|---|
| `surface_crack` | Vision | Vibration (impact signature) | high |
| `broken_rail` / `rail_gap` | Vision | Vibration | critical |
| `missing_fastener` | Vision | — | medium |
| `joint_anomaly` | Vision + Vibration | Position (segment known) | high |
| `foreign_object` | Vision | — | medium |
| `vegetation_overgrowth` | Vision | — | low |
| `geometry_anomaly` | Vibration/IMU | Vision (confirm) | medium |

### 14.3 Output contract & quality gates

- Every detection: class, bbox, confidence, frame_id, timestamp, chainage, model_version.
- **Image-quality gate (FR-306):** blur (Laplacian variance), brightness, obstruction (edge-spread histogram), entropy — below threshold → `degraded` flag; detections from degraded frames are marked and down-weighted; the operator is alerted.
- **Threshold policy:** per-class thresholds chosen on validation data; safety-relevant classes (crack, broken rail) bias toward **recall** while controlling alert fatigue via dedup + severity context.

---

## 15. Sensor Fusion & Risk Formulae

### 15.1 Fusion score

```
FusionScore = w_v · VisualScore + w_i · VibrationScore + w_p · PositionConsistency
```

- `VisualScore` — detection confidence (per-class calibrated).
- `VibrationScore` — normalized anomaly score of the time-aligned vibration window (RMS/peak/spectral-centroid deviation).
- `PositionConsistency` — agreement between the visual detection's projected location and rover position estimate (1 when consistent; decays with mismatch/uncertainty).
- Prototype weights: `w_v = 0.50, w_i = 0.35, w_p = 0.15` — **calibrated on validation data, versioned in code** (changing them creates a new formula version). A flagged/missing channel drops to weight 0 and is recorded in `sensor_summary`.

### 15.2 Risk score

```
Risk = base(severity) × confidence_factor + recurrence_bonus + trend_factor + context_factor
```

| Term | Definition | Prototype rule |
|---|---|---|
| `base(severity)` | Severity weight | low 20 · medium 40 · high 65 · critical 85 |
| `confidence_factor` | Evidence strength | 0.5 + 0.5·FusionScore |
| `recurrence_bonus` | Prior events near same chainage (14-day window) | +5 per prior event, cap +15 |
| `trend_factor` | Segment trend state | stable 0 · degrading +8 · recurring +12 |
| `context_factor` | Operational context (zone criticality, traffic, works) | zone-multiplier 0.9–1.15 |

Result clipped to [0,100]. The formula is **documented, versioned, and validated** — not an arbitrary weighted sum (P5). Outputs are labeled *risk estimation / trend*, never predictions of failure dates.

---

## 16. Non-Functional Requirements

| # | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Dashboard initial load ≤ 2.5 s on 10 Mbps; interactive in ≤ 4 s |
| NFR-2 | Live latency | Frame capture → dashboard alert ≤ 5 s end-to-end (prototype live mode); SSE event → UI render ≤ 2 s |
| NFR-3 | Edge performance | Vision pipeline ≤ 150 ms/frame target on Jetson-class hardware; ≥ 15 fps camera capture |
| NFR-4 | Rendering | 60 fps UI/map on mid hardware; DPR capped; 3D pauses off-screen (M5) |
| NFR-5 | Availability | Prototype: best-effort; production target 99.5% backend uptime with monitoring |
| NFR-6 | Reliability | No event loss across disconnects (offline buffer + sync); duplicate-event rate ≤ 5% |
| NFR-7 | Security | HTTPS/WSS, device + user auth, RBAC, audit immutability, secrets out of frontend (Section 10.11) |
| NFR-8 | Data retention | Events + audit retained indefinitely in dev DB; evidence ring buffer on rover (configurable) |
| NFR-9 | Accessibility | WCAG 2.1 AA (Section 13.6) |
| NFR-10 | Compatibility | Chrome/Firefox/Safari/Edge latest-2; desktop-first responsive |
| NFR-11 | Observability | Structured logs (JSON), request IDs, health endpoints, alert on backend degradation |

---

## 17. Testing & Validation Strategy

### 17.1 Test pyramid

| Layer | Scope |
|---|---|
| Unit | Fusion/risk formulae (FR-501–FR-605), state machine (FR-901), chainage↔coordinate math (FR-404), dedup clustering (FR-704) |
| Integration | API contract tests against OpenAPI spec; SSE behavior; offline sync (FR-709) |
| Vision | Per-class tests on a labeled synthetic set (known ground truth); confusion matrix, precision/recall/F1, per-class recall; robustness suite: lighting, blur, dirt, rain-simulated |
| UI | Component tests for severity encoding, workflow actions, reduced-motion; E2E: mission → detection → event → verify → resolve |
| Hardware | Benchmarks: FPS, latency, power, thermal (edge); E-stop/geofence/watchdog trigger tests (FR-107, FR-1002) |

### 17.2 Validation plan (honesty-driven)

1. **Synthetic labeled set** (prototype day one): procedurally generated track frames with injected ground-truth defects — enables measured metrics from day one.
2. **Collected sample set:** real track imagery captured during controlled, authorized trials; labeled by the team.
3. **Held-out evaluation:** metrics reported only on held-out splits; per-class numbers published on the ML analytics view.
4. **Localization trials:** ground-truth markers measured along the route; report median/p90 position error (Section 5.2).
5. **Field ground truth:** compare system alerts against verified inspection findings over a defined time window; this is the basis for validating the risk model — not image accuracy alone.
6. **Longitudinal:** trend/risk quality evaluated on future time windows (hold-out segments) before any stronger claims.

### 17.3 Demo flow (also the acceptance test for the full loop)

1. **Start inspection** — rover init, sensor health, localization, camera feed live.
2. **Capture** — frames + sensor values with timestamps.
3. **Detect** — known test defect shown with detection overlay.
4. **Fuse** — vibration event + visual candidate → combined evidence.
5. **Localize** — track segment + mapped location + uncertainty.
6. **Create event** — structured record with evidence, severity, risk.
7. **Dashboard update** — alert appears with history.
8. **Human verification** — operator confirms / rejects / resolves.
9. **Trend view** — repeated events / deterioration trend on the segment.
10. **Fail-safe demo** — communication loss or sensor failure → degraded mode / safe stop.

---

## 18. Release Plan & Milestones

| Milestone | Content | Exit criteria |
|---|---|---|
| **M1 · Foundations** (Wks 1–2) | PRD sign-off, architecture review, repo + CI, design system tokens | PRD approved; design tokens in code |
| **M2 · Perception** (Wks 3–5) | Synthetic frame generator + labeled set, OpenCV baseline pipeline, per-class tests | Per-class metrics measured on synthetic set |
| **M3 · Platform** (Wks 6–8) | Backend (events, track, zones, auth, audit, SSE), rover simulator (FR-711) | Full API contract green; sim drives end-to-end loop |
| **M4 · Dashboard MVP** (Wks 9–11) | All seven pages incl. Mission Map, Vision Lab, workflow; design-system compliance | Demo flow steps 1–9 pass on simulator |
| **M5 · Intelligence** (Wks 12–13) | Fusion + risk + recurrence/trend, degraded-mode alerts, safe-stop UX | Unit-tested formulae; fail-safe demo passes |
| **M6 · Hardening & field prep** (Wks 14+) | Rover bring-up, collected dataset, metrics report, controlled-trial plan | Hardware runs pipeline; honest metrics doc published |

---

## 19. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Detection accuracy varies** with lighting/weather/track condition | False positives → alert fatigue; misses → missed defects | High | Diverse data + augmentation; per-class thresholds; multi-sensor cross-check; image-quality gates; human verification loop |
| **Sensor noise/reliability** (vibration, environmental) | Wrong fusion evidence | Medium | Calibration routines, health metrics, channel flagging, weighted fusion that drops bad channels |
| **Localization error** (GNSS in cuttings, tunnels) | Defect pinned to wrong segment | High | Odometry + IMU dead-reckoning, snap-to-track, uncertainty reporting, markers/beacons roadmap |
| **Railway integration approval** | Can't deploy on operational lines early | High | Scaled track → controlled authorized trials → compliance path; prototype framed as decision support |
| **Bandwidth/storage** of continuous capture | Cost, latency | Medium | Edge filtering: metadata + thumbnails live, full evidence on demand, ring buffer |
| **AI over-trust** (safety risk) | Unsafe decisions | Low (mitigated by design) | Fail-safe stance (FR-1003), confidence + redundancy + human verification, prohibited-claims copy gate |
| **Dataset domain shift** (lab → field) | Model degrades in real conditions | High | Planned diverse collection, augmentation, per-condition evaluation, honest reporting |
| **Scope creep toward "certified product" claims** | Credibility loss | Medium | PRD Section 2.1 framing enforced in all copy, demos, and docs |

---

## 20. Assumptions & Open Questions

**Assumptions**

- A1: A wheeled rover can traverse the prototype route at 1–3 m/s with supervised operation.
- A2: The track route polyline for the prototype zone is available with ≥ 10 m baseline accuracy.
- A3: Prototype evidence stills (not video) are sufficient for MVP verification workflow.
- A4: Jetson-class edge compute meets the 150 ms/frame target for the chosen model at 640×360.
- A5: One operator supervises one rover in the prototype phase.

**Open questions**

- Q1: Which exact route zone is the first field-trial candidate? (Determines marker/beacon needs.)
- Q2: Which YOLO variant/backbone balances latency and mAP on the chosen edge board?
- Q3: Retention policy for evidence imagery (legal/privacy review required)?
- Q4: Multi-rover mission coordination — out of MVP scope, but how should the event schema anticipate it? (Proposed: `rover_id` + `mission_id` already included.)
- Q5: Integration requirements with any existing railway asset/maintenance systems (export formats: CSV/GeoJSON/REST webhooks)?

---

## 21. Appendices

### Appendix A · Panel-style one-liner

> "IRIS is not trying to replace railway expertise; it is designed to make inspection data more continuous, contextual, and actionable so that human expertise can be focused where it matters most."

### Appendix B · Five claims to avoid (copy gate)

1. "100% accurate"
2. "Predicts exact failure dates"
3. "Completely replaces manual inspection"
4. "GPS gives exact centimeter-level railway localization" (unless actually demonstrated)
5. "AI autonomously makes safety-critical decisions"

### Appendix C · Metric definitions

| Metric | Definition |
|---|---|
| Precision | TP / (TP + FP) per class on held-out set |
| Recall | TP / (TP + FN) per class on held-out set |
| F1 | Harmonic mean of precision and recall |
| mAP | Mean average precision across classes at IoU ≥ 0.5 |

| Position error | Distance between system-reported defect location and ground-truth marker, median/p90 over trials |
| Event latency | Time from frame capture (source timestamp) to event visible on dashboard |
| Duplicate-event rate | Events referencing the same physical defect / total events |
| False-alert rate | Events operator-dismissed as non-defects / operator-reviewed events |
| Coverage % | Chainage inspected / chainage assigned, per mission |

---

*End of PRD v1.0 — IRIS · Intelligent Railtrack Inspection System*


