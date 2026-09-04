"""IRIS — computer-vision pipeline (PRD §14).

Classical OpenCV baseline: pre-process (CLAHE) → rail extraction
(Canny + HoughLinesP) → per-class detectors (crack, broken rail, missing
fastener, foreign object, vegetation) → post-processing (thresholds, NMS).

Contract: consumes rover-camera BGR frames (from the simulator's synthetic
generator or an uploaded image), returns structured detections + image-quality
gate + stage images for the Vision Lab.
"""
import time

import cv2
import numpy as np

# class colours for annotation — match the dashboard categorical palette
CLASS_COLOR_BGR = {
    "surface_crack": (232, 119, 138),     # lavender #8A77E8
    "broken_rail": (164, 191, 79),        # mint #4FBFA4
    "missing_fastener": (94, 133, 242),   # peach #F2855E
    "joint_anomaly": (217, 163, 79),      # sky #4FA3D9
    "foreign_object": (39, 166, 217),     # butter #D9A627
    "vegetation": (140, 96, 224),         # rose #E0608C
}

CLASS_FLOOR = {
    "surface_crack": 0.60, "broken_rail": 0.60, "missing_fastener": 0.55,
    "foreign_object": 0.60, "vegetation": 0.55, "joint_anomaly": 0.60,
}

HORIZON = 168


def _ioverlap(a, b):
    x = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    y = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    inter = x * y
    if inter <= 0:
        return 0.0
    return inter / min(a[2] * a[3], b[2] * b[3])


def _nms(dets, thresh=0.4):
    out = []
    for d in sorted(dets, key=lambda d: -d["confidence"]):
        if not any(_ioverlap(d["bbox"], o["bbox"]) > thresh for o in out):
            out.append(d)
    return out


def _merge_nearby(dets, dist=70.0):
    """Union boxes whose centres are within `dist` px (same class)."""
    merged, used = [], set()
    for i, a in enumerate(dets):
        if i in used:
            continue
        box = list(a["bbox"])
        best = a
        for j, b in enumerate(dets):
            if j <= i or j in used:
                continue
            ca = (box[0] + box[2] / 2.0, box[1] + box[3] / 2.0)
            cb = (b["bbox"][0] + b["bbox"][2] / 2.0,
                  b["bbox"][1] + b["bbox"][3] / 2.0)
            if ((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2) ** 0.5 < dist:
                x0 = min(box[0], b["bbox"][0])
                y0 = min(box[1], b["bbox"][1])
                x1 = max(box[0] + box[2], b["bbox"][0] + b["bbox"][2])
                y1 = max(box[1] + box[3], b["bbox"][1] + b["bbox"][3])
                box = [x0, y0, x1 - x0, y1 - y0]
                if b["confidence"] > best["confidence"]:
                    best = b
                used.add(j)
        merged.append({**best, "bbox": box})
        used.add(i)
    return merged


def image_quality(gray):
    """FR-306 image-quality gate: blur (Laplacian variance) + brightness."""
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    degraded = blur < 55.0 or brightness < 72.0 or brightness > 214.0
    return {"blur": round(blur, 1), "brightness": round(brightness, 1),
            "degraded": degraded}


# ------------------------------------------------------------- rail geometry
def _extract_rails(gray):
    """Find the two rails by bright-column voting on the RAW gray frame.

    CLAHE is unusable here — it re-normalises the ballast so its stones exceed
    any fixed threshold. On the raw frame the rail steel + centre highlight
    are the brightest pixels in their row in every weather; a per-row
    percentile threshold picks them out, and column-support voting finds the
    two columns bright in (almost) every row = the rails.
    (Deliberately not Hough-based: OpenCV 5's HoughLinesP starves vertical
    lines when many strong horizontal edges are present.)
    """
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    edges = cv2.Canny(clahe, 40, 120)      # stage-visualisation only
    H, W = gray.shape
    y0, y1 = HORIZON + 24, H - 4
    bright = np.zeros((y1 - y0, W), np.uint8)
    for i, y in enumerate(range(y0, y1)):
        thr = float(np.percentile(gray[y], 96)) - 1.0
        bright[i] = (gray[y] > thr).astype(np.uint8)
    smear = cv2.dilate(bright, np.ones((1, 5), np.uint8))
    col_support = smear.sum(axis=0)
    min_support = max(24, int(0.55 * col_support.max()))

    def peak_group(cols):
        groups = []
        for c in cols:
            if groups and c - groups[-1][-1] <= 4:
                groups[-1].append(c)
            else:
                groups.append([c])
        if not groups:
            return None
        return max(groups, key=lambda g: col_support[g].mean())

    lg = peak_group(np.where(col_support[:W // 2] > min_support)[0])
    rg = peak_group(np.where(col_support[W // 2:] > min_support)[0] + W // 2)
    if lg is None or rg is None:
        return None, edges

    def fit_from(cols):
        lo, hi = max(0, cols[0] - 2), min(W - 1, cols[-1] + 2)
        band = bright[:, lo:hi + 1]
        ys, xs = np.where(band > 0)
        pts = np.stack([xs + lo, ys + y0], 1).astype(float)
        # two-pass robust fit x(y) = a·y + b
        for _ in range(2):
            A = np.stack([pts[:, 1], np.ones(len(pts))], 1)
            a, b = np.linalg.lstsq(A, pts[:, 0], rcond=None)[0]
            resid = np.abs(pts[:, 0] - (a * pts[:, 1] + b))
            keep = resid < np.median(resid) + 6.0
            if keep.all():
                break
            pts = pts[keep]
        return float(a), float(b)

    rails = [{"a": fit_from(lg)[0], "b": fit_from(lg)[1]},
             {"a": fit_from(rg)[0], "b": fit_from(rg)[1]}]
    rails.sort(key=lambda r: r["a"] * H + r["b"])   # left rail first
    return rails, edges


def _rail_x_at(rail, y):
    return rail["a"] * y + rail["b"]


def _rail_half_width(y):
    t = max(0.0, min(1.0, ((y - HORIZON) / max(1, 360 - HORIZON)) ** (1 / 1.7)))
    return 1.4 + 6.2 * t


def _rail_mask(rail, shape):
    H = shape[0]
    mask = np.zeros(shape, np.uint8)
    pts = []
    for y in range(HORIZON, H, 3):
        x = _rail_x_at(rail, y)
        w = _rail_half_width(y)
        pts.append((x - w, y))
    for y in range(H - 1, HORIZON - 1, -3):
        x = _rail_x_at(rail, y)
        w = _rail_half_width(y)
        pts.append((x + w, y))
    if len(pts) > 2:
        cv2.fillPoly(mask, [np.array(pts, np.int32)], 255)
    return mask


def _between_rails_mask(rails, shape):
    H, W = shape
    mask = np.zeros(shape, np.uint8)
    for y in range(HORIZON, H, 2):
        xl = _rail_x_at(rails[0], y)
        xr = _rail_x_at(rails[1], y)
        x0, x1 = int(xl + 2), int(xr - 2)
        if x1 > x0 + 4:
            mask[y, max(0, x0):min(W, x1)] = 255
    return mask


# ------------------------------------------------------------ per-class
def _detect_cracks(gray, hsv, rails, rng_jitter):
    """Cracks = dark strokes crossing the rail, in a dilated rail-foot ROI.

    Works on the raw gray frame: crack strokes (~50–70) sit well below the
    steel (~205+); ballast stones and the dark rim are excluded by the
    centreline-crossing geometry test and a green-exclusion mask.
    """
    hue, s, v = cv2.split(hsv)
    greenish = (hue >= 35) & (hue <= 85) & (s > 60)
    sleeper = _sleeper_band_mask(cv2.createCLAHE(clipLimit=2.5,
                                                 tileGridSize=(8, 8))
                                 .apply(gray))
    dets = []
    for rail in rails:
        base = _rail_mask(rail, gray.shape)
        roi = cv2.dilate(base, np.ones((13, 13), np.uint8))
        # sleeper strips beside the rail are excluded (they merge with cracks
        # that sit on a sleeper and balloon the contour) — but not on the
        # rail steel itself, where a crack must stay connected
        sleeper_outside = sleeper & ~cv2.dilate(base, np.ones((9, 9), np.uint8))
        dark = np.zeros_like(gray)
        dark[((gray < 110) & (roi > 0) & ~greenish
              & (sleeper_outside == 0)).astype(bool)] = 255
        dark[:HORIZON + 10, :] = 0
        dark[gray.shape[0] - 14:, :] = 0
        dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < 25 or area > 450:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if h < 6 or w < 6 or h > 48 or w > 56:
                continue                      # compact stroke, not rim strings
            hull = cv2.convexHull(c)
            solidity = area / max(1.0, cv2.contourArea(hull))
            if solidity > 0.92:
                continue
            # geometric signature: a crack spans the whole rail — the dark
            # region must extend past the steel on BOTH sides of the rail
            # (rims hug one edge; stones sit off to the side)
            y_mid = y + h / 2.0
            cx_line = _rail_x_at(rail, y_mid)
            rw = _rail_half_width(y_mid)
            if not (x + 2 <= cx_line - rw and x + w - 2 >= cx_line + rw):
                continue
            conf = min(0.95, 0.72 + 0.20 * (110.0 - min(60.0,
                     float(gray[max(0, y):y + h, max(0, x):x + w].min()))) / 50.0
                     + rng_jitter)
            dets.append({"class": "surface_crack", "confidence": conf,
                         "bbox": [x - 3, y - 3, w + 6, h + 6]})
    return dets


def _detect_gaps(clahe, rails, rng_jitter):
    dets = []
    H = clahe.shape[0]
    for rail in rails:
        # sample the rail centreline (bright highlight) — a gap shows ballast
        ys = np.arange(252, H - 6, 2)
        xs = np.array([_rail_x_at(rail, y) for y in ys])
        profile = clahe[ys, np.clip(xs.astype(int), 0, clahe.shape[1] - 1)]
        profile = profile.astype(float)
        med = float(np.median(profile))
        dark = profile < min(168.0, med - 40.0)
        run_start = None
        for k in range(len(dark) + 1):
            if k < len(dark) and dark[k]:
                if run_start is None:
                    run_start = k
            else:
                if run_start is not None and (k - run_start) >= 3:  # ≥6px tall
                    seg = profile[run_start:k]
                    y0, y1 = int(ys[run_start]), int(ys[k - 1])
                    if y1 < H - 4:
                        x = _rail_x_at(rail, (y0 + y1) / 2)
                        wpx = _rail_half_width((y0 + y1) / 2) * 2.6
                        conf = min(0.94, 0.76 + (med - seg.min()) / 110.0
                                   + rng_jitter)
                        dets.append({"class": "broken_rail",
                                     "confidence": conf,
                                     "bbox": [int(x - wpx) - 3, y0 - 3,
                                              int(2 * wpx) + 6, y1 - y0 + 6]})
                run_start = None
    return dets


def _detect_missing_fasteners(gray, clahe, rails, rail_masks, rng_jitter):
    """Sleepers = dark horizontal bands; clips = bright blobs beside rails.

    A missing fastener is flagged when one rail side shows no clip blob at a
    sleeper while the other side does (asymmetry evidence). Clips are found on
    the RAW frame (brightest structures beside the rail — on CLAHE they merge
    with the rail steel).
    """
    H, W = clahe.shape
    sleeper = _sleeper_band_mask(clahe)
    rows_with_sleepers = np.where(sleeper.sum(axis=1) > 0)[0]
    if len(rows_with_sleepers) < 3:
        return []
    # group sleeper rows into bands
    bands = []
    start = rows_with_sleepers[0]
    prev = rows_with_sleepers[0]
    for r in rows_with_sleepers[1:]:
        if r - prev > 3:
            bands.append((start, prev))
            start = r
        prev = r
    bands.append((start, prev))

    dets = []
    for y0, y1 in bands:
        yc = (y0 + y1) // 2
        if yc < 300:
            continue
        bright = (gray[max(0, y0 - 2):y1 + 2, :] > 222).astype(np.uint8) * 255
        contours, _ = cv2.findContours(bright, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
        blobs = []
        rail_zone = cv2.dilate(rail_masks[0] | rail_masks[1],
                               np.ones((5, 5), np.uint8))
        for c in contours:
            area = cv2.contourArea(c)
            if area < 8 or area > 120:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if w < 2:                          # 1px slivers = highlight bleed
                continue
            cx, cy = x + w / 2.0, y0 + y + h / 2.0
            if rail_zone[max(0, min(H - 1, int(cy))),
                         max(0, min(W - 1, int(cx)))]:
                continue            # rail steel/highlight bleed — not a clip
            blobs.append((cx, cy))
        if not blobs:
            continue
        t = ((yc - HORIZON) / (H - HORIZON)) ** (1 / 1.7)
        counts = []
        for side, rail in enumerate(rails):
            x_exp = _rail_x_at(rail, yc) + (1 if side else -1) * \
                (_rail_half_width(yc) + 2.5 + 3.0 * t)
            counts.append(sum(1 for cx, cy in blobs
                              if abs(cx - x_exp) < 4.5 and abs(cy - yc) < 5))
        for side in (0, 1):
            if counts[side] == 0 and counts[1 - side] >= 1:
                x_exp = _rail_x_at(rails[side], yc)
                wpx = _rail_half_width(yc) * 3.0
                conf = min(0.82, 0.62 + rng_jitter)
                dets.append({"class": "missing_fastener", "confidence": conf,
                             "bbox": [int(x_exp - wpx) - 4, y0 - 4,
                                      int(2 * wpx) + 8, y1 - y0 + 8]})
    return dets


CX_BAND = (640 / 2 - 72, 640 / 2 + 72)


def _sleeper_band_mask(clahe):
    """Horizontal bands covering visible sleeper rows (dark row-mean dips)."""
    H = clahe.shape[0]
    profile = clahe[200:H - 4, int(CX_BAND[0]):int(CX_BAND[1])].mean(axis=1)
    profile = np.convolve(profile, np.ones(5) / 5, mode="same")
    med = float(np.median(profile))
    mask = np.zeros(clahe.shape, np.uint8)
    rows = profile < med - 11.0
    y = 0
    while y < len(rows):
        if rows[y]:
            y2 = y
            while y2 < len(rows) and rows[y2]:
                y2 += 1
            if y2 - y >= 4:
                mask[max(0, 200 + y - 2):min(H, 200 + y2 + 2), :] = 255
            y = y2
        else:
            y += 1
    return mask


def _detect_foreign_objects(img_hsv, between_mask, rng_jitter):
    hue, s, v = cv2.split(img_hsv)
    sat = ((s > 72) & (v > 105) & (between_mask > 0)).astype(np.uint8) * 255
    sat = cv2.morphologyEx(sat, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    sat = cv2.morphologyEx(sat, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(sat, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    dets = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 70 or area > 6000:
            continue
        x, y, w, hh = cv2.boundingRect(c)
        if w < 5 or hh < 4 or w / max(1.0, hh) > 3.2 or hh / max(1.0, w) > 3.2:
            continue
        mask = np.zeros(img_hsv.shape[:2], np.uint8)
        cv2.drawContours(mask, [c], -1, 255, -1)
        if mask.sum() == 0:
            continue
        mh = hue[mask > 0].mean()
        if 35 <= mh <= 85:                    # green → vegetation handles it
            continue
        conf = min(0.93, 0.74 + s[mask > 0].mean() / 260.0 + rng_jitter)
        dets.append({"class": "foreign_object", "confidence": conf,
                     "bbox": [x - 4, y - 4, w + 8, hh + 8]})
    return dets


def _detect_vegetation(img_hsv, rail_envelope, rng_jitter):
    hue, s, v = cv2.split(img_hsv)
    green = ((hue >= 35) & (hue <= 85) & (s > 80) & (v > 45)
             & (rail_envelope > 0)).astype(np.uint8) * 255
    green = cv2.morphologyEx(green, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(green, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    dets = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 170:
            continue
        x, y, w, hh = cv2.boundingRect(c)
        mask = np.zeros(img_hsv.shape[:2], np.uint8)
        cv2.drawContours(mask, [c], -1, 255, -1)
        conf = min(0.88, 0.66 + s[mask > 0].mean() / 300.0 + rng_jitter)
        dets.append({"class": "vegetation", "confidence": conf,
                     "bbox": [x - 4, y - 4, w + 8, hh + 8]})
    return dets


# ------------------------------------------------------------------- main
def analyze(img, with_stages=False):
    """Run the full pipeline on a BGR image. Returns a result dict."""
    t0 = time.perf_counter()
    rng_jitter = np.random.default_rng(int(t0 * 1e6) % 2**32).uniform(-0.02, 0.02)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    quality = image_quality(gray)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    rails, edges = _extract_rails(gray)
    detections = []

    if rails is not None:
        rail_masks = [_rail_mask(r, gray.shape) for r in rails]
        # 1px erosion keeps the dark rim outside the steel excluded while
        # preserving thin defect strokes crossing the rail
        rail_masks = [cv2.erode(m, np.ones((3, 3), np.uint8)) for m in rail_masks]
        between = _between_rails_mask(rails, gray.shape)
        envelope = cv2.dilate(rail_masks[0] | rail_masks[1],
                              np.ones((45, 45), np.uint8))
        detections += _detect_gaps(clahe, rails, rng_jitter)
        detections += _detect_cracks(gray, hsv, rails, rng_jitter)
        detections += _detect_missing_fasteners(gray, clahe, rails, rail_masks,
                                                rng_jitter)
        detections += _detect_foreign_objects(hsv, between, rng_jitter)
        detections += _detect_vegetation(hsv, envelope, rng_jitter)

        # cross-class arbitration at the same location (one anomaly, one class)
        gaps = [d["bbox"] for d in detections if d["class"] == "broken_rail"]
        detections = [d for d in detections
                      if d["class"] != "surface_crack"
                      or not any(_ioverlap(d["bbox"], g) > 0.25 for g in gaps)]
        other = [d["bbox"] for d in detections
                 if d["class"] in ("surface_crack", "vegetation")]
        detections = [d for d in detections
                      if d["class"] != "broken_rail"
                      or not any(_ioverlap(d["bbox"], o) > 0.25 for o in other)]

    # post-processing: merge scattered same-class blobs (vegetation clusters),
    # apply per-class confidence floors, NMS, cap
    veg = [d for d in detections if d["class"] == "vegetation"]
    detections = [d for d in detections if d["class"] != "vegetation"]
    detections += _merge_nearby(veg)
    detections = [d for d in detections
                  if d["confidence"] >= CLASS_FLOOR[d["class"]]]
    by_class = {}
    for d in detections:
        by_class.setdefault(d["class"], []).append(d)
    detections = []
    for cls, ds in by_class.items():
        detections += _nms(ds)
    detections.sort(key=lambda d: -d["confidence"])
    detections = detections[:6]

    if quality["degraded"]:
        for d in detections:
            d["confidence"] = round(min(d["confidence"], 0.55), 3)
    for d in detections:
        d["confidence"] = round(d["confidence"], 3)

    result = {
        "quality": quality,
        "rails_found": rails is not None,
        "detections": detections,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
    }
    if with_stages:
        result["stages"] = _stage_images(img, gray, clahe, edges, rails)
    return result


def _stage_images(img, gray, clahe, edges, rails):
    """BGR images for the Vision Lab stage strip."""
    stages = [("raw", img.copy())]

    p = cv2.cvtColor(clahe, cv2.COLOR_GRAY2BGR)
    stages.append(("preprocessed", p))

    e = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    stages.append(("edges", e))

    geo = img.copy()
    if rails:
        H = geo.shape[0]
        for rail in rails:
            ys = np.arange(HORIZON, H, 2)
            xs = np.array([_rail_x_at(rail, y) for y in ys], np.int32)
            pts = np.stack([xs, ys], 1)
            cv2.polylines(geo, [pts], False, (0, 180, 255), 2)
    stages.append(("rails", geo))
    return stages


def annotate(img, detections, with_header=True):
    """Draw detection boxes + labels. Returns BGR image."""
    out = img.copy()
    for d in detections:
        x, y, w, h = d["bbox"]
        color = CLASS_COLOR_BGR.get(d["class"], (120, 120, 120))
        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
        label = f"{d['class'].replace('_', ' ')}  {d['confidence']:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(out, (x, max(0, y - th - 6)), (x + tw + 6, y), color, -1)
        cv2.putText(out, label, (x + 3, max(th + 1, y - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1,
                    cv2.LINE_AA)
    if with_header:
        cv2.putText(out, "IRIS · edge vision", (8, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (46, 42, 59), 1, cv2.LINE_AA)
    return out
