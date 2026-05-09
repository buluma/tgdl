"""
Compare arcface-onnx vs InsightFace built-in ArcFace face comparison.

Usage:
  source ~/venvs/hf/bin/activate
  python scripts/ai/test_compare_arcface.py <image1> [image2 ...]
"""

import sys, os, time, glob
import cv2
import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download

# ── Models ────────────────────────────────────────────────────────────────

print("── Loading models ──", flush=True)
t0 = time.time()

# arcface-onnx (standalone)
model_path = hf_hub_download(repo_id='onnx-community/arcface-onnx', filename='arcface.onnx')
sess = ort.InferenceSession(model_path)
in_name = sess.get_inputs()[0].name
out_name = sess.get_outputs()[0].name

# InsightFace (detection + built-in ArcFace w600k_r50)
import insightface
from insightface.app import FaceAnalysis
detector = FaceAnalysis(name='buffalo_l', root='./data/insightface', providers=['CPUExecutionProvider'])
detector.prepare(ctx_id=0, det_size=(640, 640))

print(f"  Loaded in {time.time()-t0:.1f}s\n", flush=True)

# ── Helpers ──────────────────────────────────────────────────────────────

def preprocess_onnx(face_crop):
    """Preprocess for arcface-onnx: 112x112, (127.5, 128) normalisation, NHWC."""
    img = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (112, 112))
    img = (img.astype(np.float32) - 127.5) / 128.0
    return img[np.newaxis, ...]  # (1, 112, 112, 3)

def embed_onnx(face_crop):
    """arcface-onnx → 512-dim, L2 normalised."""
    emb = sess.run([out_name], {in_name: preprocess_onnx(face_crop)})[0][0]
    return emb / np.linalg.norm(emb)

def cosine(a, b):
    return float(np.dot(a, b))

def fmt_box(b):
    return f"[{b[0]:.0f},{b[1]:.0f}→{b[2]:.0f},{b[3]:.0f}]"

# ── Get images ────────────────────────────────────────────────────────────

paths = sys.argv[1:] if len(sys.argv) > 1 else sorted(glob.glob("data/downloads/*/images/*.jpg"))[:3]
if not paths:
    print("No images. Pass paths as arguments.")
    sys.exit(1)

# ── Process ───────────────────────────────────────────────────────────────

results = {}
print("── Processing ──\n")
for img_path in paths:
    img = cv2.imread(img_path)
    if img is None:
        continue
    print(f"  📷 {os.path.basename(img_path)}  ({img.shape[1]}x{img.shape[0]})", flush=True)

    t1 = time.time()
    dets = detector.get(img)
    dt = time.time() - t1

    entries = []
    for i, d in enumerate(dets):
        x1, y1, x2, y2 = [int(v) for v in d.bbox]
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        # InsightFace built-in ArcFace (w600k_r50) — already in d.embedding
        if_emb = d.embedding / np.linalg.norm(d.embedding)

        # Standalone arcface-onnx
        t2 = time.time()
        onnx_emb = embed_onnx(crop)
        onnx_ms = (time.time() - t2) * 1000

        entries.append({
            'bbox': d.bbox, 'score': float(d.det_score),
            'if_emb': if_emb, 'onnx_emb': onnx_emb, 'onnx_ms': onnx_ms,
        })
        print(f"    Face #{i+1}: score={d.det_score:.4f}  box={fmt_box(d.bbox)}  "
              f"onnx={onnx_ms:.0f}ms")

        # Compare the two ArcFace embeddings for the SAME face
        same_sim = cosine(if_emb, onnx_emb)
        print(f"      IF-arcface ↔ onnx-arcface (same face): cos={same_sim:.4f}")

    results[img_path] = entries
    print()

# ── Cross-image comparison (both embedders) ──────────────────────────────

keys = list(results.keys())
if len(keys) >= 2:
    print("── Cross-image similarity ──\n")
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            for fi, a in enumerate(results[keys[i]]):
                for fj, b in enumerate(results[keys[j]]):
                    ni = os.path.basename(keys[i])
                    nj = os.path.basename(keys[j])
                    if_sim = cosine(a['if_emb'], b['if_emb'])
                    onnx_sim = cosine(a['onnx_emb'], b['onnx_emb'])
                    print(f"  {ni}#{fi+1} ↔ {nj}#{fj+1}")
                    print(f"    InsightFace ArcFace: cos={if_sim:.4f}  {'✅' if if_sim > 0.3 else '❌'}")
                    print(f"    onnx-arcface:        cos={onnx_sim:.4f}  {'✅' if onnx_sim > 0.3 else '❌'}")
                    print()

print("── Done ──")
