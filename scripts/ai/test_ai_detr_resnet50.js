/**
 * Test script for Xenova/detr-resnet-50 object detection.
 *
 * Run: cd tgdl && node scripts/ai/test_ai_detr_resnet50.js
 *
 * Compares output with the current default Xenova/yolos-tiny.
 */

import { pipeline } from '@huggingface/transformers';

// ── Helpers ──────────────────────────────────────────────────────────────

function formatBox(box) {
  const { xmin, ymin, xmax, ymax } = box;
  return `[${xmin.toFixed(0)}, ${ymin.toFixed(0)} → ${xmax.toFixed(0)}, ${ymax.toFixed(0)}] (${((xmax - xmin) * (ymax - ymin)).toFixed(0)} px²)`;
}

function formatDetections(dets, label) {
  console.log(`\n  ${label} (${dets.length} detections):`);
  for (const d of dets) {
    console.log(`    • ${d.label.padEnd(12)} score=${d.score.toFixed(4)}  box=${formatBox(d.box)}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

// const URL = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
const URL = 'data/thumbs/6c79932a6a57dcc63894f2fa91e39fd7.webp';
const LOCAL = process.argv[2] || '';  // optional local image path

// 1. Load DETR-ResNet-50
console.log('\n── Loading Xenova/detr-resnet-50 ──');
const startLoad = performance.now();
const detr = await pipeline('object-detection', 'Xenova/detr-resnet-50');
console.log(`  Loaded in ${((performance.now() - startLoad) / 1000).toFixed(1)}s\n`);

// 2. Test on tiger image
console.log(`── Remote test: ${URL} ──`);
const urlDets = await detr(URL, { threshold: 0.9 });
formatDetections(urlDets, 'detr-resnet-50');

// 3. Test on local image if provided
if (LOCAL) {
  console.log(`\n── Local test: ${LOCAL} ──`);
  const localDets = await detr(LOCAL, { threshold: 0.5 });
  formatDetections(localDets, 'detr-resnet-50');

  // Show only person-class detections (COCO class 1 = "person")
  const people = localDets.filter(d => d.label === 'person');
  if (people.length) {
    console.log(`\n  → ${people.length} person(s) detected:`);
    for (const p of people) {
      console.log(`    • score=${p.score.toFixed(4)}  box=${formatBox(p.box)}`);
    }
  }
}

// 4. Stats
console.log(`\n── Model info ──`);
console.log(`  Model: Xenova/detr-resnet-50`);
console.log(`  Pipeline: object-detection`);
console.log(`  Labels: COCO 91-class (person = class 1)`);
console.log(`  Threshold used: ${LOCAL ? 0.5 : 0.9}`);
