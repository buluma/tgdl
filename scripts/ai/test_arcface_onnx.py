"""
Test onnx-community/arcface-onnx for face comparison.

Usage:
  source ~/venvs/hf/bin/activate
  python scripts/ai/test_arcface_onnx.py <image1> [image2 ...]

Detects faces with InsightFace, then compares using arcface-onnx.
"""

import sys, os, time, glob
import cv2
import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download

# ── Load arcface-onnx model ──────────────────────────────────────────────

print("── Loading arcface-onnx ──", flush=True)
t0 = time.time()
model_path = hf_hub_download(repo_id='onnx-community/arcface-onnx', filename='arcface.onnx')
sess = ort.InferenceSession(model_path)
input_name = sess.get_inputs()[0].name
output_name = sess.get_outputs()[0].name
print(f"  Loaded in {time.time()-t0:.1f}s")
print(f"  Input:  {sess.get_inputs()[0].shape}")
print(f"  Output: {sess.get_outputs()[0].shape}\n")

# ── Face detection via InsightFace ───────────────────────────────────────

print("── Loading InsightFace (for detection only) ──", flush=True)
t0 = time.time()
import insightface
from insightface.app import FaceAnalysis
detector = FaceAnalysis(name='buffalo_l', root='./data/insightface', providers=['CPUExecutionProvider'])
detector.prepare(ctx_id=0, det_size=(640, 640))
print(f"  Loaded in {time.time()-t0:.1f}s\n", flush=True)

# ── Helpers ──────────────────────────────────────────────────────────────

def preprocess_face(face_crop):
    """Resize face crop to 112x112 and normalise for arcface-onnx."""
    img = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (112, 112))
    img = (img.astype(np.float32) - 127.5) / 128.0
    return img[np.newaxis, ...]  # (1, 112, 112, 3)

def embed_face(face_crop):
    """Run face crop through arcface-onnx, return normalised 512-dim vector."""
    blob = preprocess_face(face_crop)
    emb = sess.run([output_name], {input_name: blob})[0][0]
    return emb / np.linalg.norm(emb)

def cosine(a, b):
    return float(np.dot(a, b))

# ── Get images ────────────────────────────────────────────────────────────

paths = sys.argv[1:] if len(sys.argv) > 1 else sorted(glob.glob("data/downloads/*/images/*.jpg"))[:3]
if not paths:
    print("No images found. Pass paths as arguments.")
    sys.exit(1)

# ── Process ───────────────────────────────────────────────────────────────

all_embs = {}  # img_path -> [(idx, bbox, score, emb)]

print("── Processing ──\n")
for img_path in paths:
    if not os.path.isfile(img_path):
        print(f"  SKIP: {img_path}")
        continue
    img = cv2.imread(img_path)
    if img is None:
        print(f"  SKIP (unreadable): {img_path}")
        continue
    print(f"  📷 {os.path.basename(img_path)}  ({img.shape[1]}x{img.shape[0]})", flush=True)

    t1 = time.time()
    dets = detector.get(img)
    dt = time.time() - t1
    print(f"     Detection: {len(dets)} face(s) in {dt*1000:.0f}ms")

    entries = []
    for i, d in enumerate(dets):
        x1, y1, x2, y2 = [int(v) for v in d.bbox]
        face_crop = img[y1:y2, x1:x2]
        if face_crop.size == 0:
            continue

        t2 = time.time()
        emb = embed_face(face_crop)
        et = time.time() - t2

        entries.append((i, (x1, y1, x2, y2), float(d.det_score), emb))
        print(f"     Face #{i+1}: score={d.det_score:.4f}  "
              f"box=[{x1},{y1}→{x2},{y2}]  "
              f"embed={et*1000:.0f}ms  norm={np.linalg.norm(emb):.4f}")

    all_embs[img_path] = entries
    print()

# ── Cross-image comparison ───────────────────────────────────────────────

keys = list(all_embs.keys())
if len(keys) >= 2:
    print("── Cross-image similarity (arcface-onnx) ──\n")
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            for fi, (idx_a, bbox_a, score_a, emb_a) in enumerate(all_embs[keys[i]]):
                for fj, (idx_b, bbox_b, score_b, emb_b) in enumerate(all_embs[keys[j]]):
                    sim = cosine(emb_a, emb_b)
                    name_a = os.path.basename(keys[i])
                    name_b = os.path.basename(keys[j])
                    print(f"  {name_a}#{idx_a+1} ↔ {name_b}#{idx_b+1}:  cos={sim:.4f}"
                          f"  {'✅ SAME' if sim > 0.4 else '❌ diff'}")

    # Also compare faces within the same image
    for p in keys:
        entries = all_embs[p]
        if len(entries) >= 2:
            print(f"\n  (Same image faces: {os.path.basename(p)})")
            for i in range(len(entries)):
                for j in range(i + 1, len(entries)):
                    sim = cosine(entries[i][3], entries[j][3])
                    print(f"     Face #{entries[i][0]+1} ↔ Face #{entries[j][0]+1}:  cos={sim:.4f}")

print("\n── Done ──")
