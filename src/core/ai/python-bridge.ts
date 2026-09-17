/**
 * Python bridge for face detection + ArcFace recognition.
 *
 * Spawns a Python subprocess that runs the lean InsightFace pipeline
 * (detection + recognition only, no 3D landmarks or gender/age models).
 *
 * The Python process is kept alive for multiple calls via a persistent
 * JSON-line protocol (stdin → stdout) to avoid reloading models per image.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'ai', 'detect_faces.py');
const VENV_PYTHON = path.join(os.homedir(), 'venvs', 'hf', 'bin', 'python');

// ── Types ────────────────────────────────────────────────────────────────

export interface FaceDetection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  score: number;
  embedding: number[];  // 512-dim L2-normalised
}

export interface FaceDetectionResult {
  faces: FaceDetection[];
  error: string | null;
}

// ── Persistent subprocess ────────────────────────────────────────────────

let _proc: import('child_process').ChildProcess | null = null;
let _pending: ((result: FaceDetectionResult) => void)[] = [];
let _buf = '';

/** Start or re-use the long-lived Python worker. */
function _ensureProc() {
  if (_proc && _proc.exitCode === null) return _proc;
  _buf = '';
  _proc = spawn(VENV_PYTHON, [SCRIPT_PATH, '--persist'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ORT_LOG_LEVEL: '3', PYTHONUNBUFFERED: '1' },
  });

  // Accumulate stdout lines
  _proc.stdout!.on('data', (chunk: Buffer) => {
    _buf += chunk.toString();
    // Try to parse complete JSON lines
    let idx;
    while ((idx = _buf.indexOf('\n')) >= 0) {
      const line = _buf.slice(0, idx).trim();
      _buf = _buf.slice(idx + 1);
      if (!line) continue;
      const pending = _pending.shift();
      if (pending) {
        try {
          pending(JSON.parse(line));
        } catch {
          pending({ faces: [], error: `JSON parse error: ${line.slice(0, 200)}` });
        }
      }
    }
  });

  _proc.stderr!.on('data', (chunk: Buffer) => {
    // stderr may contain harmless ONNX warnings; only log non-runtime lines
    const text = chunk.toString();
    if (text.includes('Error') || text.includes('Traceback')) {
      console.error('[py-faces]', text.trim());
    }
  });

  _proc.on('exit', () => {
    _proc = null;
    // Reject any remaining pending
    for (const p of _pending) p({ faces: [], error: 'Python process exited' });
    _pending = [];
  });

  return _proc;
}

/**
 * Detect faces in an image using the Python InsightFace pipeline.
 * Returns face bounding boxes + ArcFace embeddings in one shot.
 */
export function detectFacesPython(absPath: string): Promise<FaceDetectionResult> {
  return new Promise((resolve, reject) => {
    const proc = _ensureProc();
    if (!proc || !proc.stdin) {
      resolve({ faces: [], error: 'Failed to start Python process' });
      return;
    }
    _pending.push(resolve);
    proc.stdin.write(absPath + '\n');
    // Timeout safety
    setTimeout(() => {
      const idx = _pending.indexOf(resolve);
      if (idx >= 0) {
        _pending.splice(idx, 1);
        resolve({ faces: [], error: 'Face detection timed out' });
      }
    }, 30_000);
  });
}

/**
 * Kill the persistent Python process (call on shutdown).
 */
export function shutdownPythonFaces() {
  if (_proc) {
    _proc.stdin?.end();
    _proc.kill();
    _proc = null;
  }
}

// ── Non-persistent (one-shot) fallback ──────────────────────────────────

/**
 * One-shot face detection — spawns Python per call.
 * Slower but simpler; used when the persistent process isn't available.
 */
export function detectFacesOneShot(absPath: string): Promise<FaceDetectionResult> {
  return new Promise((resolve) => {
    const proc = spawn(VENV_PYTHON, [SCRIPT_PATH, absPath], {
      env: { ...process.env, ORT_LOG_LEVEL: '3' },
    });
    let out = '', err = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ faces: [], error: err.slice(0, 500) || `exit code ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve({ faces: [], error: `JSON parse error: ${out.slice(0, 200)}` });
      }
    });
    proc.on('error', (e) => {
      resolve({ faces: [], error: e.message });
    });
  });
}

// Auto-cleanup on process exit
process.on('exit', () => { shutdownPythonFaces(); });
