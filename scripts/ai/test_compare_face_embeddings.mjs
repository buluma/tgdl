/**
 * Compare face embeddings: ArcFace (InsightFace, via subprocess) vs
 * CLIP ViT-L/14 (Transformers.js) vs current SigLIP-B/16.
 *
 * Usage:
 *   node scripts/ai/test_compare_face_embeddings.js [image_path...]
 *
 * With two+ images, shows cross-image similarity for each embedder.
 */

import { pipeline } from '@huggingface/transformers';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = process.cwd();

// ── Helpers ──────────────────────────────────────────────────────────────

function eol() { console.log(); }

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function formatVec(v) {
  if (!v || v.length < 5) return 'N/A';
  return `[${v.slice(0, 5).map(x => x.toFixed(4)).join(', ')}, …]`;
}

// ── 1. Load CLIP ViT-L/14 + SigLIP-B/16 via Transformers.js ────────────

console.log('── [1/3] Loading CLIP ViT-L/14 + SigLIP-B/16 (Transformers.js) ──\n');

async function loadModel(modelId, label) {
  const t0 = performance.now();
  const pipe = await pipeline('image-feature-extraction', modelId, { quantized: true });
  console.log(`  ✓ ${label.padEnd(25)} loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  return pipe;
}

const [clipPipe, siglipPipe] = await Promise.all([
  loadModel('Xenova/clip-vit-large-patch14',  'CLIP-ViT-L/14'),
  loadModel('Xenova/siglip-base-patch16-256-multilingual', 'SigLIP-B/16 (current)'),
]);
eol();

// ── 2. Get images ────────────────────────────────────────────────────────

let imagePaths = process.argv.slice(2);
if (!imagePaths.length) {
  // find jpgs from downloads
  const glob = await import('glob');
  imagePaths = (await glob.glob('data/downloads/*/images/*.jpg')).slice(0, 3);
}
if (!imagePaths.length) {
  console.error('No images found. Pass paths as arguments.');
  process.exit(1);
}

// ── 3. Process each image via InsightFace (Python subprocess) ────────────

console.log(`── [2/3] Detecting faces with InsightFace (Python) ──\n`);

// We'll call the python script once per image, capturing JSON output.
// The Python script writes face detections + ArcFace embeddings as JSON.

const python = path.join(os.homedir(), 'venvs/hf/bin/python');
const detectScript = path.join(PROJECT_ROOT, 'scripts/ai', '_detect_faces.py');

// Write the helper Python script first
const pyCode = `
import sys, json, cv2, numpy as np
import insightface
from insightface.app import FaceAnalysis

app = FaceAnalysis(name='buffalo_l', root='${PROJECT_ROOT}/data/insightface'.replace(/\\\\/g,'/'),
                   providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

img = cv2.imread(sys.argv[1])
if img is None:
    print(json.dumps({"error": "unreadable", "path": sys.argv[1]}))
    sys.exit(0)

dets = app.get(img)
results = []
for d in dets:
    bbox = d.bbox.tolist() if hasattr(d.bbox, 'tolist') else list(d.bbox)
    results.append({
        "bbox": bbox,
        "score": float(d.det_score),
        "embedding": d.embedding.tolist() if hasattr(d.embedding, 'tolist') else list(d.embedding),
        "landmarks": d.landmark.tolist() if d.landmark is not None else None,
    })
print(json.dumps({"faces": results, "path": sys.argv[1], "shape": list(img.shape[:2])}))
`;
fs.writeFileSync(detectScript, pyCode, 'utf-8');

const allFaces = {};

for (const imgPath of imagePaths) {
  if (!fs.existsSync(imgPath)) { console.log(`  SKIP: ${imgPath}`); continue; }

  console.log(`  📷 ${path.basename(imgPath)}`, flush = true);

  const t0 = performance.now();
  const proc = spawnSync(python, [detectScript, path.resolve(imgPath)], {
    encoding: 'utf-8',
    timeout: 30000,
  });
  const dt = performance.now() - t0;

  let data;
  try { data = JSON.parse(proc.stdout); } catch { data = { error: 'parse failed', stderr: proc.stderr?.slice(0, 200) }; }

  if (data.error) {
    console.log(`     InsightFace error: ${data.error}`);
    continue;
  }

  console.log(`     InsightFace: ${data.faces.length} face(s) in ${dt.toFixed(0)}ms (${data.shape[1]}x${data.shape[0]})`);

  const img = await import('sharp').then(s => s.default(imgPath));
  const meta = await img.metadata();

  const faceList = [];
  for (let i = 0; i < data.faces.length; i++) {
    const f = data.faces[i];
    const [x1, y1, x2, y2] = f.bbox.map(Math.round);
    const w = Math.max(1, x2 - x1);
    const h = Math.max(1, y2 - y1);
    console.log(`     Face #${i + 1}: score=${f.score.toFixed(4)}  box=[${x1}, ${y1} → ${x2}, ${y2}] (${w}x${h})`);

    // Extract face crop using sharp
    let cropBuf;
    try {
      cropBuf = await img.clone()
        .extract({ left: x1, top: y1, width: w, height: h })
        .png()
        .toBuffer();
    } catch {
      console.log(`       (crop failed, skipping CLIP/SigLIP)`);
      faceList.push({ arcface: f.embedding, clipEmb: null, siglipEmb: null, bbox: f.bbox, score: f.score });
      continue;
    }

    // CLIP ViT-L/14 embedding
    const t1 = performance.now();
    const clipOut = await clipPipe(cropBuf, { pooling: 'mean', normalize: true });
    const clipEmb = Array.isArray(clipOut) && clipOut[0]?.data
      ? Array.from(clipOut[0].data)
      : Array.isArray(clipOut?.data) ? Array.from(clipOut.data) : null;
    const clipTime = performance.now() - t1;

    // SigLIP-B/16 embedding
    const t2 = performance.now();
    const sigOut = await siglipPipe(cropBuf, { pooling: 'mean', normalize: true });
    const siglipEmb = Array.isArray(sigOut) && sigOut[0]?.data
      ? Array.from(sigOut[0].data)
      : Array.isArray(sigOut?.data) ? Array.from(sigOut.data) : null;
    const sigTime = performance.now() - t2;

    if (clipEmb && siglipEmb && f.embedding) {
      console.log(`       ArcFace  : dim=${f.embedding.length}  ${formatVec(f.embedding)}`);
      console.log(`       CLIP-L/14: dim=${clipEmb.length}  ${formatVec(clipEmb)}  (${clipTime.toFixed(0)}ms)`);
      console.log(`       SigLIP   : dim=${siglipEmb.length}  ${formatVec(siglipEmb)}  (${sigTime.toFixed(0)}ms)`);
      console.log(`       ArcFace ↔ CLIP  cos=${cosine(f.embedding, clipEmb).toFixed(4)}`);
      console.log(`       ArcFace ↔ SigLIP cos=${cosine(f.embedding, siglipEmb).toFixed(4)}`);
      console.log(`       CLIP    ↔ SigLIP cos=${cosine(clipEmb, siglipEmb).toFixed(4)}`);
    }

    faceList.push({ arcface: f.embedding, clipEmb, siglipEmb, bbox: f.bbox, score: f.score });
  }
  allFaces[imgPath] = faceList;
  eol();
}

// ── 4. Cross-image comparison ────────────────────────────────────────────

const keys = Object.keys(allFaces);
if (keys.length >= 2) {
  console.log('── [3/3] Cross-image similarity ──\n');
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = allFaces[keys[i]];
      const b = allFaces[keys[j]];
      for (let fi = 0; fi < a.length; fi++) {
        for (let fj = 0; fj < b.length; fj++) {
          const nameA = path.basename(keys[i]);
          const nameB = path.basename(keys[j]);
          console.log(`  ${nameA}#${fi + 1} ↔ ${nameB}#${fj + 1}`);
          if (a[fi].arcface && b[fj].arcface)
            console.log(`    ArcFace  cos=${cosine(a[fi].arcface, b[fj].arcface).toFixed(4)}`);
          if (a[fi].clipEmb && b[fj].clipEmb)
            console.log(`    CLIP-L   cos=${cosine(a[fi].clipEmb, b[fj].clipEmb).toFixed(4)}`);
          if (a[fi].siglipEmb && b[fj].siglipEmb)
            console.log(`    SigLIP   cos=${cosine(a[fi].siglipEmb, b[fj].siglipEmb).toFixed(4)}`);
          eol();
        }
      }
    }
  }
}

// Cleanup temp script
try { fs.unlinkSync(detectScript); } catch {}

console.log('── Done ──');
