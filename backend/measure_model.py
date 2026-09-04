"""IRIS — measure per-class metrics on the synthetic labelled set.

Runs the vision pipeline over patrol frames with known ground truth and
writes backend/data/model_metrics.json, consumed by GET /api/analytics/model
(PRD §17.2 — honest, measured numbers).
"""
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

from frames import generate_frame  # noqa: E402
from vision import analyze  # noqa: E402

N = 150  # more than one patrol loop (90 frames) for stable numbers
tp = {}
gt_count = {}
det_count = {}
fp = {}

for i in range(N):
    img, gt, meta = generate_frame(i)
    res = analyze(img)
    gt_c = [g["class"] for g in gt]
    det_c = [d["class"] for d in res["detections"]]
    for c in gt_c:
        gt_count[c] = gt_count.get(c, 0) + 1
        if c in det_c:
            tp[c] = tp.get(c, 0) + 1
    for c in det_c:
        det_count[c] = det_count.get(c, 0) + 1
        if c not in gt_c:
            fp[c] = fp.get(c, 0) + 1

rows = []
for c in sorted(set(list(gt_count) + list(det_count))):
    g = gt_count.get(c, 0)
    t = tp.get(c, 0)
    d = det_count.get(c, 0)
    recall = t / g if g else None
    precision = t / d if d else None
    f1 = (2 * precision * recall / (precision + recall)
          if precision and recall else None)
    rows.append({
        "class": c,
        "samples": g,
        "detections": d,
        "false_positives": fp.get(c, 0),
        "precision": round(precision, 3) if precision is not None else None,
        "recall": round(recall, 3) if recall is not None else None,
        "f1": round(f1, 3) if f1 is not None else None,
    })

out = {
    "per_class": rows,
    "measured_on": "synthetic labelled set (rover-camera geometry, 640×360)",
    "frames": N,
    "note": "Classical OpenCV baseline — measured, not estimated. YOLO "
            "augmentation planned (PRD FR-305).",
}
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
            exist_ok=True)
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data",
                    "model_metrics.json")
with open(path, "w") as f:
    json.dump(out, f, indent=2)

print(json.dumps(out, indent=2))
