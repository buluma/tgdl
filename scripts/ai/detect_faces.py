"""
Lean face detection + ArcFace recognition for tgdl.
Called from Node.js as a subprocess.

Usage:
  python scripts/ai/detect_faces.py <image_path>

Outputs JSON to stdout:
  {
    "faces": [
      {
        "bbox": [x1, y1, x2, y2],
        "score": 0.95,
        "embedding": [0.123, -0.456, ...]   // 512-dim L2-normalised
      }
    ],
    "error": null
  }
"""

import sys, os, json, traceback

# Suppress ONNX Runtime macOS console warnings
os.environ['ORT_LOG_LEVEL'] = '3'

import numpy as np
import cv2

# Lazy-loaded singleton so the process can be kept alive for multiple calls
_detector = None
_recognizer = None
_face_align = None

# Stale ONNX Runtime macOS shape warnings — suppress via os env
os.environ['ORT_LOG_LEVEL'] = '3'
# Also tell onnxruntime to not print to stderr at all
import logging
logging.getLogger('onnxruntime').setLevel(logging.ERROR)

def _load():
    global _detector, _recognizer, _face_align
    if _detector is not None:
        return

    import onnxruntime
    from insightface.model_zoo.retinaface import RetinaFace
    from insightface.model_zoo.arcface_onnx import ArcFaceONNX
    from insightface.utils import face_align

    base = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'insightface', 'models')
    # Prefer buffalo_s lean pack, fallback to buffalo_l
    for pack, det_file, rec_file in [
        ('buffalo_s', 'det_500m.onnx', 'w600k_mbf.onnx'),
        ('buffalo_l', 'det_10g.onnx',  'w600k_r50.onnx'),
    ]:
        det_path = os.path.join(base, pack, det_file)
        rec_path = os.path.join(base, pack, rec_file)
        if os.path.exists(det_path) and os.path.exists(rec_path):
            break
    else:
        raise RuntimeError("No InsightFace model pack found")

    so = onnxruntime.SessionOptions()
    so.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.enable_mem_pattern = False
    so.enable_cpu_mem_arena = False

    _detector = RetinaFace(model_file=det_path, session=None)
    _detector.prepare(ctx_id=0, input_size=(320, 320))

    _recognizer = ArcFaceONNX(model_file=rec_path, session=None)
    _recognizer.prepare(ctx_id=0)
    _face_align = face_align


def detect_faces(img_path):
    """Returns list of {bbox, score, embedding}."""
    _load()

    img = cv2.imread(img_path)
    if img is None:
        return {'error': f'Cannot read image: {img_path}', 'faces': []}

    bboxes, kpss = _detector.detect(img, max_num=10, metric='default')
    if bboxes is None or len(bboxes) == 0:
        return {'faces': [], 'error': None}

    results = []
    for i in range(len(bboxes)):
        bbox = bboxes[i]  # [x1, y1, x2, y2, score]
        kps = kpss[i] if kpss is not None else None
        score = float(bbox[4])

        # Aligned face crop using InsightFace's utility
        aimg = _face_align.norm_crop(img, kps) if kps is not None else None
        if aimg is None or aimg.size == 0:
            # Fallback: raw crop
            x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
            x1 = max(0, x1); y1 = max(0, y1)
            x2 = min(img.shape[1], x2); y2 = min(img.shape[0], y2)
            if x2 - x1 <= 0 or y2 - y1 <= 0:
                continue
            aimg = img[y1:y2, x1:x2]
            if aimg.size == 0:
                continue

        # Get ArcFace embedding and normalise
        emb = _recognizer.get_feat(aimg).flatten()
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = (emb / norm).tolist()
        else:
            emb = emb.tolist()

        results.append({
            'bbox': [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])],
            'score': score,
            'embedding': emb,
        })

    return {'faces': results, 'error': None}


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == '--persist':
        # Persistent mode: read image paths line-by-line from stdin,
        # write JSON results line-by-line to stdout. Models stay loaded.
        _load()
        for line in sys.stdin:
            img_path = line.strip()
            if not img_path:
                continue
            try:
                result = detect_faces(img_path)
                print(json.dumps(result), flush=True)
            except Exception as e:
                print(json.dumps({'error': str(e), 'faces': []}), flush=True)
    elif len(sys.argv) >= 2:
        try:
            result = detect_faces(sys.argv[1])
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({'error': str(e), 'faces': [], 'traceback': traceback.format_exc()}))
    else:
        print(json.dumps({'error': 'Usage: detect_faces.py [--persist] <image_path>', 'faces': []}))
        sys.exit(1)
