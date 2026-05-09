"""
Minimal InsightFace — detection + recognition only.
Skips 3D landmarks (137 MB), 2D landmarks, and gender/age.

Usage:
  source ~/venvs/hf/bin/activate
  python scripts/ai/test_insightface_lean.py [image_path ...]
"""

import sys, os, time, glob, threading
import numpy as np
import cv2
import logging
logging.getLogger('onnxruntime').setLevel(logging.ERROR)

# ── Monitor ───────────────────────────────────────────────────────────────

stats = []
MONITOR = True
def monitor():
    pid = os.getpid()
    while MONITOR:
        r = os.popen(f'ps -o rss= -p {pid}').read().strip()
        stats.append({'t': time.time(), 'rss': int(r)*1024 if r else 0})
        time.sleep(0.5)
t = threading.Thread(target=monitor, daemon=True)
t.start()

# ── Load only detection + recognition ────────────────────────────────────

print("── Loading lean models (detection + recognition only) ──", flush=True)
t0 = time.time()

from insightface.model_zoo.retinaface import RetinaFace
from insightface.model_zoo.arcface_onnx import ArcFaceONNX

import insightface
from insightface.utils import face_align
import onnxruntime

# Model paths (use buffalo_s for smaller recognition model)
base = './data/insightface/models/buffalo_s'
det_path = os.path.join(base, 'det_500m.onnx')
rec_path = os.path.join(base, 'w600k_mbf.onnx')

# Fallback to buffalo_l if buffalo_s not available
if not os.path.exists(det_path):
    base = './data/insightface/models/buffalo_l'
    det_path = os.path.join(base, 'det_10g.onnx')
    rec_path = os.path.join(base, 'w600k_r50.onnx')

print(f"  Detection:    {os.path.basename(det_path)}", flush=True)
print(f"  Recognition:  {os.path.basename(rec_path)}", flush=True)

so = onnxruntime.SessionOptions()
so.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_ENABLE_ALL

detector = RetinaFace(model_file=det_path, session=None)
detector.prepare(ctx_id=0, input_size=(320, 320))

recognizer = ArcFaceONNX(model_file=rec_path, session=None)
recognizer.prepare(ctx_id=0)

print(f"  Loaded in {time.time()-t0:.1f}s\n", flush=True)

# ── Process images ────────────────────────────────────────────────────────

paths = sys.argv[1:] if len(sys.argv) > 1 else sorted(glob.glob("data/downloads/*/images/*.jpg"))[:3]
all_embs = {}

for img_path in paths:
    img = cv2.imread(img_path)
    if img is None:
        continue
    print(f"  📷 {os.path.basename(img_path)[:30]:30s} ({img.shape[1]}x{img.shape[0]})", flush=True)

    t1 = time.time()
    bboxes, kpss = detector.detect(img, max_num=10, metric='default')
    det_time = time.time() - t1

    entries = []
    for i in range(len(bboxes)):
        if bboxes.shape[0] == 0:
            break
        bbox = bboxes[i]  # [x1, y1, x2, y2, score]
        kps = kpss[i] if kpss is not None else None
        score = float(bbox[4])

        t2 = time.time()
        # Use InsightFace's face_align for proper alignment before recognition
        aimg = face_align.norm_crop(img, kps) if kps is not None else None
        if aimg is None:
            # Fallback: simple crop
            x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
            x1 = max(0, x1); y1 = max(0, y1)
            x2 = min(img.shape[1], x2); y2 = min(img.shape[0], y2)
            if x2 - x1 <= 0 or y2 - y1 <= 0:
                continue
            aimg = img[y1:y2, x1:x2]
            if aimg.size == 0:
                continue

        # Use get_feat directly; normalise output for valid cosine
        emb = recognizer.get_feat(aimg).flatten()
        emb_norm = np.linalg.norm(emb)
        if emb_norm > 0:
            emb = emb / emb_norm
        emb_time = time.time() - t2
        norm = np.linalg.norm(emb)

        print(f"    Face #{i+1}: score={score:.4f}  "
              f"box=[{bbox[0]:.0f},{bbox[1]:.0f}→{bbox[2]:.0f},{bbox[3]:.0f}]  "
              f"det={det_time*1000:.0f}ms  emb={emb_time*1000:.0f}ms  norm={norm:.2f}",
              flush=True)
        entries.append(emb)

    all_embs[img_path] = entries
    print()

# ── Cross-image comparison ────────────────────────────────────────────────

keys = list(all_embs.keys())
if len(keys) >= 2:
    print("── Cross-image similarity ──\n")
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            for fi, ei in enumerate(all_embs[keys[i]]):
                for fj, ej in enumerate(all_embs[keys[j]]):
                    if ei is None or ej is None:
                        continue
                    sim = float(np.dot(ei, ej))
                    a = os.path.basename(keys[i])
                    b = os.path.basename(keys[j])
                    print(f"  {a}#{fi+1} ↔ {b}#{fj+1}: cos={sim:.4f}  {'✅' if sim > 0.3 else '❌'}")

MONITOR = False
time.sleep(0.5)

# ── Report ────────────────────────────────────────────────────────────────
if stats:
    mems = [s['rss'] for s in stats]
    print(f"\n── RAM (lean: det + rec only) ──")
    print(f"  Peak:   {max(mems) / 1048576:.1f} MB")
    print(f"  Final:  {mems[-1] / 1048576:.1f} MB")
    print(f"  Delta:  {(mems[-1] - mems[0]) / 1048576:.1f} MB")
