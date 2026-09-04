"""IRIS — synthetic track-frame generator (PRD FR-711 simulator vision source).

Deterministically renders 640×360 rover-camera frames of a rail corridor with
perspective, and injects ground-truth defects (crack, broken rail, missing
fastener, foreign object, vegetation). Every frame returns its ground truth so
the vision pipeline can be measured against a labelled set (PRD §17.2).

Design contract with vision.py: rails are bright steel (≈200+), sleepers dark
brown bands, ballast mid-grey/low-saturation, clips very bright small blobs,
foreign objects saturated warm hues, vegetation saturated green.
"""
import math
import os

import cv2
import numpy as np

W, H = 640, 360
HORIZON = 168
CX = W / 2.0

FRAMES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frames")

# Deterministic per-frame RNG: same frame index → same image every patrol.
SEED_BASE = 20260821


def _rng(frame_idx):
    return np.random.default_rng(SEED_BASE + frame_idx * 7919)


# ------------------------------------------------------------- perspective
def _py(t):
    """Y for depth parameter t∈[0,1] (0 = horizon, 1 = bottom edge)."""
    return HORIZON + (H - HORIZON) * t ** 1.7


def _rail_x(t, side, curve):
    """Rail centre x at depth t. side: -1 left, +1 right."""
    half_gap = 4.0 + 66.0 * t ** 1.6
    x = CX + side * half_gap
    x += curve * math.sin(t * math.pi * 2.4 + 0.6 * side) * t * 9.0
    return x


def _rail_w(t):
    return 1.4 + 6.2 * t  # half-width px at depth t


# ---------------------------------------------------------------- painting
def _paint_sky(img, rng):
    top = np.array([203, 227, 242], float)   # pastel blue
    hor = np.array([253, 247, 238], float)   # warm horizon
    for y in range(HORIZON):
        t = y / HORIZON
        img[y, :] = hor * t + top * (1 - t)
    # sun glow
    sx, sy = int(W * 0.74), 46
    glow = np.zeros((H, W), np.float32)
    cv2.circle(glow, (sx, sy), 60, 0.35, -1)
    cv2.circle(glow, (sx, sy), 26, 0.75, -1)
    img[:HORIZON, :] = (img[:HORIZON, :] * (1 - glow[:HORIZON, :, None] * 0.35)
                        + np.array([255, 246, 214]) * glow[:HORIZON, :, None] * 0.35)
    # clouds
    for _ in range(3):
        cxx = rng.integers(40, W - 40)
        cyy = rng.integers(24, 90)
        rx = rng.integers(26, 60)
        overlay = img.copy()
        cv2.ellipse(overlay, (int(cxx), int(cyy)), (int(rx), int(rx * 0.36)),
                    0, 0, 360, (255, 255, 255), -1)
        img[:] = cv2.addWeighted(overlay, 0.45, img, 0.55, 0)


def _paint_hills(img, rng):
    pts = []
    for x in range(0, W + 8, 8):
        n = (math.sin(x * 0.021) + math.sin(x * 0.009 + 2.0)) / 2.0
        pts.append((x, HORIZON - int(6 + n * 14 + rng.uniform(-1.5, 1.5))))
    pts += [(W, HORIZON), (0, HORIZON)]
    pts = np.array(pts, np.int32)
    cv2.fillPoly(img, [pts], (178, 170, 201))          # lavender hills


def _paint_ballast(img, rng, stones=850):
    ground = np.full((H - HORIZON, W, 3), 158.0)
    # speckle noise
    ground += rng.normal(0, 14, ground.shape)
    for _ in range(stones):
        t = rng.random() ** 1.15
        y = _py(t) - HORIZON
        x = CX + (rng.random() - 0.5) * 2 * (96.0 * t + 60.0)
        r = 0.7 + 3.4 * t + rng.random() * 1.6
        shade = int(rng.integers(112, 192))
        cv2.circle(ground, (int(x), int(y)), max(1, int(r)),
                   (shade, shade - 8, shade - 14), -1)
    img[HORIZON:, :] = ground


def _sleeper_t(ns=14):
    return [((i + 0.5) / ns) ** 0.55 for i in range(ns)]


def _paint_sleepers(img, rng, curve, ns=14):
    for i in range(ns):
        t = _sleeper_t(ns)[i]
        y = _py(t)
        xl = _rail_x(t, -1, curve) - _rail_w(t) * 4.2
        xr = _rail_x(t, 1, curve) + _rail_w(t) * 4.2
        h = max(1.0, 1.4 + 5.2 * t)
        shade = int(rng.integers(96, 122))
        cv2.rectangle(img, (int(xl), int(y - h / 2)), (int(xr), int(y + h / 2)),
                      (shade, shade - 14, shade - 26), -1)


def _paint_clips(img, rng, curve, missing=None, ns=14):
    """Bright fastening clips on each rail foot. missing=(idx, side) skips."""
    for i in range(ns):
        t = _sleeper_t(ns)[i]
        y = _py(t)
        if missing and missing[0] == i:
            sides = [s for s in (-1, 1) if s != missing[1]]
        else:
            sides = (-1, 1)
        for side in sides:
            xc = _rail_x(t, side, curve) + side * (_rail_w(t) + 2.0 + 3.0 * t)
            s = max(1.0, 1.3 + 2.8 * t)
            cv2.rectangle(img, (int(xc - s), int(y - s * 0.8)),
                          (int(xc + s), int(y + s * 0.8)), (236, 239, 243), -1)


def _paint_rails(img, curve, gap=None):
    """Rails as perspective polygons. gap=(t0, gap_t, side, shift_px)."""
    ts = np.linspace(0.0, 1.0, 90)
    for side in (-1, 1):
        segs = [(0.0, 1.0)]
        if gap and gap[2] == side:
            t0, gt = gap[0], gap[1]
            segs = [(0.0, max(0.0, t0)), (min(1.0, t0 + gt), 1.0)]
        for a, b in segs:
            m = (ts >= a) & (ts <= b)
            if m.sum() < 2:
                continue
            tt = ts[m]
            xs = np.array([_rail_x(t, side, curve) for t in tt])
            ws = np.array([_rail_w(t) for t in tt])
            ys = np.array([_py(t) for t in tt])
            pts = np.concatenate([
                np.stack([xs - ws, ys], 1),
                np.stack([xs[::-1] + ws[::-1], ys[::-1]], 1),
            ]).astype(np.int32)
            cv2.fillPoly(img, [pts], (207, 212, 218))
            # centre highlight (thin — a thick one bleeds into clip detection)
            hl = np.stack([xs, ys], 1).astype(np.int32)
            cv2.polylines(img, [hl], False, (238, 242, 246), 2)
        # gap fill: dark ballast where steel should be
        if gap and gap[2] == side:
            t0, gt, _, shift = gap
            t_mid = min(1.0, t0 + gt / 2)
            y0, y1 = _py(max(0.0, t0)), _py(min(1.0, t0 + gt))
            xc = _rail_x(t_mid, side, curve)
            wpx = _rail_w(t_mid) * 2.4
            cv2.rectangle(img, (int(xc - wpx), int(y0)), (int(xc + wpx), int(y1)),
                          (118, 104, 96), -1)
            cv2.rectangle(img, (int(xc - wpx), int(y0)), (int(xc + wpx), int(y1)),
                          (84, 74, 68), 1)


# ---------------------------------------------------------------- defects
def _inject_crack(img, rng, curve):
    side = rng.choice([-1, 1])
    t0 = rng.uniform(0.42, 0.93)
    y0 = _py(t0)
    xc = _rail_x(t0, side, curve)
    wpx = _rail_w(t0)
    h_c = 10.0 + 30.0 * t0
    n = int(rng.integers(7, 10))
    xs = xc - wpx * 2.6 + np.linspace(0, wpx * 5.2, n) + rng.normal(0, 1.4, n)
    ys = np.linspace(y0 - h_c / 2, y0 + h_c / 2, n) + rng.normal(0, 1.2, n)
    pts = np.stack([xs, ys], 1).astype(np.int32)
    cv2.polylines(img, [pts], False, (52, 56, 64), max(2, int(1.6 + 2.4 * t0)))
    x, y, w, h = int(xs.min()), int(ys.min()), int(xs.max() - xs.min()), int(ys.max() - ys.min())
    return {"class": "surface_crack", "bbox": [max(0, x - 3), max(0, y - 3), w + 6, h + 6],
            "rail": side}


def _inject_gap(img, rng, curve):
    side = rng.choice([-1, 1])
    t0 = rng.uniform(0.40, 0.95)
    gap_px = 7.0 + 9.0 * t0
    dydt = (H - HORIZON) * 1.7 * t0 ** 0.7
    gap_t = gap_px / max(1.0, dydt)
    _paint_rails(img, curve, gap=(t0, gap_t, side, rng.choice([0, 0, 1.4])))
    y0 = _py(t0)
    xc = _rail_x(t0, side, curve)
    wpx = _rail_w(t0) * 2.8
    return {"class": "broken_rail", "bbox": [int(xc - wpx) - 3, int(y0) - 3,
                                             int(2 * wpx) + 6, int(gap_px) + 6],
            "rail": side}


def _inject_missing_fastener(img, rng, curve):
    idx = int(rng.integers(8, 14))
    side = rng.choice([-1, 1])
    _paint_clips(img, rng, curve, missing=(idx, side))
    t = _sleeper_t()[idx]
    y = _py(t)
    xc = _rail_x(t, side, curve)
    wpx = _rail_w(t) * 3.2
    return {"class": "missing_fastener", "bbox": [int(xc - wpx) - 4, int(y - 6),
                                                  int(2 * wpx) + 8, 12],
            "rail": side}


def _inject_foreign_object(img, rng, curve):
    t0 = rng.uniform(0.35, 0.92)
    y = _py(t0)
    x = (CX + (rng.random() - 0.5) * 0.5
         * (_rail_x(t0, 1, curve) - _rail_x(t0, -1, curve)))
    sx = 7.0 + 15.0 * t0
    sy = 5.0 + 11.0 * t0
    colors = [(255, 176, 64), (255, 112, 82), (224, 64, 60), (250, 140, 52)]
    color = colors[int(rng.integers(0, len(colors)))]
    # soft shadow
    cv2.ellipse(img, (int(x), int(y + sy * 0.55)), (int(sx * 0.6), int(sy * 0.22)),
                0, 0, 360, (110, 96, 90), -1)
    cv2.rectangle(img, (int(x - sx / 2), int(y - sy / 2)),
                  (int(x + sx / 2), int(y + sy / 2)), color, -1)
    return {"class": "foreign_object", "bbox": [int(x - sx / 2) - 4, int(y - sy / 2) - 4,
                                                int(sx) + 8, int(sy) + 8], "rail": 0}


def _inject_vegetation(img, rng, curve):
    side = rng.choice([-1, 1])
    t0 = rng.uniform(0.45, 0.95)
    xc = _rail_x(t0, side, curve) + side * _rail_w(t0) * 0.8
    y = _py(t0)
    greens = [(62, 132, 74), (82, 152, 88), (48, 108, 62)]
    x0 = x0_orig = xc
    y0 = y
    for _ in range(int(rng.integers(6, 10))):
        gx = x0 + rng.uniform(-1, 1) * _rail_w(t0) * 2.4
        gy = y0 + rng.uniform(-0.8, 0.8) * 9.0 * t0
        r = (2.6 + 6.5 * t0) * rng.uniform(0.7, 1.3)
        cv2.circle(img, (int(gx), int(gy)), max(1, int(r)),
                   greens[int(rng.integers(0, 3))], -1)
    r = 8.0 + 16.0 * t0
    return {"class": "vegetation", "bbox": [int(x0_orig - r), int(y0 - r),
                                            int(2 * r), int(2 * r)], "rail": side}


# deterministic "hero" frames so the demo always has showcase detections
HERO_FRAMES = {12: "surface_crack", 30: "broken_rail", 48: "missing_fastener",
               66: "foreign_object", 84: "vegetation"}
DEGRADED_FRAMES = {23, 71}


def generate_frame(frame_idx, weather=None):
    """Render frame `frame_idx`. Returns (bgr_img, ground_truth, meta)."""
    rng = _rng(frame_idx)
    img = np.zeros((H, W, 3), np.uint8)
    curve = rng.uniform(-1, 1) * 0.35

    # choose weather: degraded frames are blurry/dark (quality-gate demo)
    if frame_idx in DEGRADED_FRAMES:
        weather = "degraded"
    elif weather is None:
        weather = rng.choice(["clear", "clear", "clear", "cloudy"])

    _paint_sky(img, rng)
    _paint_hills(img, rng)
    _paint_ballast(img, rng)
    _paint_sleepers(img, rng, curve)
    _paint_rails(img, curve)
    _paint_clips(img, rng, curve)

    gt = []
    classes = [HERO_FRAMES[frame_idx]] if frame_idx in HERO_FRAMES else []
    if not classes:
        for cls, p in (("surface_crack", 0.16), ("broken_rail", 0.06),
                       ("missing_fastener", 0.10), ("foreign_object", 0.10),
                       ("vegetation", 0.08)):
            if rng.random() < p:
                classes.append(cls)
    for cls in classes:
        if cls == "surface_crack":
            gt.append(_inject_crack(img, rng, curve))
        elif cls == "broken_rail":
            gt.append(_inject_gap(img, rng, curve))
        elif cls == "missing_fastener":
            gt.append(_inject_missing_fastener(img, rng, curve))
        elif cls == "foreign_object":
            gt.append(_inject_foreign_object(img, rng, curve))
        elif cls == "vegetation":
            gt.append(_inject_vegetation(img, rng, curve))

    # weather post-processing
    if weather == "cloudy":
        img[:] = cv2.convertScaleAbs(img, alpha=0.82, beta=-6)
    elif weather == "degraded":
        img[:] = cv2.GaussianBlur(img, (9, 9), 3.4)
        img[:] = cv2.convertScaleAbs(img, alpha=0.78, beta=-14)

    meta = {"frame_idx": frame_idx, "weather": weather,
            "degraded": weather == "degraded"}
    return img, gt, meta


def frame_path(frame_idx):
    return os.path.join(FRAMES_DIR, f"f{frame_idx:04d}.jpg")


def get_frame(frame_idx, cached=True):
    """Load (or generate + cache) a frame. Returns (img, gt, meta)."""
    path = frame_path(frame_idx)
    if cached and os.path.exists(path):
        img = cv2.imread(path)
        if img is not None:
            gt = [g for g in _ground_truth_of(frame_idx)]
            meta = {"frame_idx": frame_idx,
                    "weather": "degraded" if frame_idx in DEGRADED_FRAMES else "clear",
                    "degraded": frame_idx in DEGRADED_FRAMES}
            return img, gt, meta
    img, gt, meta = generate_frame(frame_idx)
    os.makedirs(FRAMES_DIR, exist_ok=True)
    cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return img, gt, meta


def _ground_truth_of(frame_idx):
    """Re-derive ground truth without regenerating pixels (cheap rebuild)."""
    img, gt, _ = generate_frame(frame_idx)
    return gt


def warmup(frames, callback=None):
    """Pre-generate a range of frames (background thread friendly)."""
    done = 0
    for i in frames:
        get_frame(i)
        done += 1
        if callback:
            callback(done)
    return done
