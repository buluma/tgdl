"""
Test script for InsightFace face detection (Python).
Run from project root:
  source ~/venvs/hf/bin/activate && python scripts/ai/test_insightface.py [image_path]

If no image path given, uses a test image from local downloads.
"""

import sys, os, json, time

# ── Load face detector ───────────────────────────────────────────────────

print("── Loading InsightFace (buffalo_l) ──", flush=True)
t0 = time.time()
import insightface
from insightface.app import FaceAnalysis
from insightface.data import get_image as ins_get_image

app = FaceAnalysis(name='buffalo_l', root='./data/insightface', providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))
print(f"  Loaded in {time.time() - t0:.1f}s")
print(f"  Model pack: buffalo_l")
print(f"  Detection model: SCRFD-10G")
print(f"  Recognition model: ArcFace W600K-R50")
print()

# ── Pick image ───────────────────────────────────────────────────────────

if len(sys.argv) > 1:
    img_path = sys.argv[1]
else:
    # Fallback: find any .jpg in downloads
    import glob
    jpgs = sorted(glob.glob("data/downloads/*/images/*.jpg"))
    if jpgs:
        img_path = jpgs[0]
    else:
        print("No image found. Pass a path as argument.")
        sys.exit(1)

if not os.path.isfile(img_path):
    print(f"File not found: {img_path}")
    sys.exit(1)

import cv2
img = cv2.imread(img_path)
if img is None:
    print(f"Could not read image: {img_path}")
    sys.exit(1)

print(f"── Detecting faces in: {img_path} ({img.shape[1]}x{img.shape[0]}) ──", flush=True)
t1 = time.time()
faces = app.get(img)
dt = time.time() - t1

print(f"  Found {len(faces)} face(s) in {dt*1000:.0f}ms")
print()

for i, face in enumerate(faces):
    bbox = face.bbox  # [xmin, ymin, xmax, ymax]
    det_score = face.det_score
    landmarks = face.landmark  # 5 points: [left_eye, right_eye, nose, left_mouth, right_mouth]
    embedding = face.embedding
    age = face.age if hasattr(face, 'age') and face.age else '?'
    gender = face.gender if hasattr(face, 'gender') and face.gender else '?'

    print(f"  Face #{i + 1}:")
    print(f"    Detection score : {det_score:.4f}")
    print(f"    Bounding box    : [{bbox[0]:.0f}, {bbox[1]:.0f} → {bbox[2]:.0f}, {bbox[3]:.0f}]"
          f" ({((bbox[2]-bbox[0]) * (bbox[3]-bbox[1])):.0f} px²)")
    if landmarks is not None and len(landmarks):
        print(f"    Landmarks (5pt) :")
        for j, pt in enumerate(landmarks):
            labels = ['left_eye', 'right_eye', 'nose', 'left_mouth', 'right_mouth']
            print(f"      {labels[j]}: ({pt[0]:.1f}, {pt[1]:.1f})")
    if embedding is not None:
        emb_norm = (embedding ** 2).sum() ** 0.5
        print(f"    Embedding       : 512-dim, norm={emb_norm:.3f}")

print()
print("── Comparison check ──")
print(f"  With multiple faces, the script would compute cosine similarity")
print(f"  between embeddings to check if they're the same person.")
print(f"  (skip for single face)")

# If multiple faces, show similarity matrix
if len(faces) >= 2:
    print()
    print("── Face similarity ──")
    for i in range(len(faces)):
        for j in range(i + 1, len(faces)):
            sim = (faces[i].embedding * faces[j].embedding).sum() / (
                (faces[i].embedding ** 2).sum() ** 0.5 * (faces[j].embedding ** 2).sum() ** 0.5
            )
            print(f"  Face #{i+1} ↔ Face #{j+1}: cosine_sim={sim:.4f}")
