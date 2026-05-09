/**
 * Image + text embeddings via Transformers.js.
 *
 * Encodes images to an L2-normalised Float32Array and text queries to the same
 * vector space. Cosine similarity between an image vector and a text vector
 * gives a "how well does this caption match this photo" score — the mechanism
 * behind every "show me beach photos" search.
 *
 * Default model: `Xenova/siglip-base-patch16-256-multilingual` (370 MB, 768-dim,
 * 50+ languages). Operators who prefer the smaller English-only CLIP encoder can
 * swap via the Models panel. Both are L2-normalised before storage so the search
 * hot path is a plain dot product (see vector-store.js).
 *
 * Model lifecycle is owned by `models.js`; this module is a thin wrapper.
 */

import { existsSync } from 'fs';
import { getPipeline, AI_MODEL_DEFAULTS, getClipTextEncoder } from './models.js';
import { l2Normalize } from './vector-store.js';

let _imagePipelinePromise = null;
let _textPipelinePromise = null;

function _imageModelId(cfg) {
    return cfg?.model || AI_MODEL_DEFAULTS.embeddings.modelId;
}
function _textModelId(cfg) {
    return cfg?.textModel || _imageModelId(cfg);
}

async function _getImagePipeline(cfg, onProgress, onLog) {
    if (_imagePipelinePromise) return _imagePipelinePromise;
    _imagePipelinePromise = getPipeline({
        kind: AI_MODEL_DEFAULTS.embeddings.kind,
        modelId: _imageModelId(cfg),
        cacheDir: cfg?.cacheDir,
        onProgress,
        onLog,
    }).catch((e) => {
        _imagePipelinePromise = null;
        throw e;
    });
    return _imagePipelinePromise;
}

async function _getTextPipeline(cfg, onProgress, onLog) {
    if (_textPipelinePromise) return _textPipelinePromise;
    const modelId = _textModelId(cfg);

    // Transformers.js maps `pipeline('feature-extraction', clip-vit-...)` to
    // the vision tower, so calling it with text fails at runtime with
    // "Missing the following inputs: pixel_values". CLIP needs its text tower
    // loaded directly (tokenizer + CLIPTextModelWithProjection); see
    // models.getClipTextEncoder(). Non-CLIP embedding models keep using the
    // generic feature-extraction pipeline.
    const loader = /(^|\/)clip[-_]/i.test(modelId)
        ? getClipTextEncoder({ modelId, cacheDir: cfg?.cacheDir, onProgress, onLog })
        : getPipeline({
            kind: AI_MODEL_DEFAULTS.embeddings.textKind,
            modelId,
            cacheDir: cfg?.cacheDir,
            onProgress,
            onLog,
        });

    _textPipelinePromise = loader.catch((e) => {
        _textPipelinePromise = null;
        throw e;
    });
    return _textPipelinePromise;
}

/**
 * Encode an image file to an L2-normalised Float32Array.
 *
 * Returns null when the file is missing or the pipeline fails to decode it
 * (corrupt JPEG / unsupported format) — the caller persists the row's
 * `ai_indexed_at` timestamp regardless so the loop doesn't keep retrying.
 */
export async function embedImage(absPath, cfg, onProgress, onLog) {
    if (!absPath) return null;
    // Most callers pass a path, but face clustering passes an in-memory crop
    // Buffer. Only path inputs can/should be checked with existsSync().
    if (typeof absPath === 'string' && !existsSync(absPath)) return null;
    const pipeline = await _getImagePipeline(cfg, onProgress, onLog);
    let out;
    try {
        out = await pipeline(absPath);
    } catch {
        return null;
    }
    return _toFloat32(out);
}

/**
 * Encode a text query to an L2-normalised Float32Array.
 */
export async function embedText(query, cfg, onProgress, onLog) {
    if (!query || typeof query !== 'string') return null;
    const pipeline = await _getTextPipeline(cfg, onProgress, onLog);
    let out;
    try {
        out = await pipeline(query, { pooling: 'mean', normalize: false });
    } catch (e) {
        (onLog || console.error)({ source: 'ai', level: 'warn', msg: `embedText failed: ${e?.message || e}` });
        return null;
    }
    return _toFloat32(out);
}

/**
 * Coerce the various output shapes Transformers.js may return into a
 * single Float32Array. Different pipeline kinds return:
 *   - { data: Float32Array | number[] }                     (newer image-feature-extraction)
 *   - { dims: [...], data: Float32Array, ... } (Tensor)     (image / text embeddings)
 *   - [ { data: ... } ]                                     (some text pipelines wrap)
 *   - Float32Array                                          (rare)
 *
 * Shape handling. `dims` from a Transformers.js Tensor tells us how to
 * collapse the buffer:
 *   - `[batch, dim]`       → row 0 verbatim (CLIP image / pooled text)
 *   - `[batch, seq, dim]`  → mean-pool over the seq axis (SigLIP text
 *                            encoder when `pooling:'mean'` doesn't get
 *                            applied because the head returns the raw
 *                            sequence). Defence-in-depth: even when we
 *                            pass `{pooling:'mean'}` the model output
 *                            shape varies between transformers.js patch
 *                            versions, so we cover the unpooled case.
 *   - flat / unknown       → treat the buffer as a single 1-D vector
 *
 * After collapsing, we L2-normalise so `dot(a, b) === cosine(a, b)`.
 */
function _toFloat32(out) {
    if (!out) return null;
    // Some text pipelines wrap the result in a [{ data, dims }] array.
    if (Array.isArray(out) && out.length && out[0]?.data) out = out[0];
    // Direct Float32Array / number[] payload — no shape hint, treat as 1-D.
    if (out instanceof Float32Array || (Array.isArray(out) && typeof out[0] === 'number')) {
        const arr = _arrayLikeToFloat32(out);
        return arr && arr.length ? l2Normalize(arr) : null;
    }
    const dims = Array.isArray(out.dims) ? out.dims : null;
    const buf = _arrayLikeToFloat32(out.data || out);
    if (!buf || !buf.length) return null;
    let collapsed = buf;
    if (dims && dims.length === 3) {
        // [batch, seq, dim] — mean-pool over seq. Use first batch only;
        // we never call with batched queries.
        const seq = Number(dims[1]) || 1;
        const dim = Number(dims[2]) || buf.length / seq;
        if (seq > 0 && dim > 0 && seq * dim <= buf.length) {
            collapsed = new Float32Array(dim);
            for (let s = 0; s < seq; s++) {
                const base = s * dim;
                for (let d = 0; d < dim; d++) collapsed[d] += buf[base + d];
            }
            for (let d = 0; d < dim; d++) collapsed[d] /= seq;
        }
    } else if (dims && dims.length === 2) {
        // [batch, dim] — take row 0.
        const dim = Number(dims[1]) || buf.length;
        if (dim > 0 && dim <= buf.length) {
            collapsed = new Float32Array(buf.subarray(0, dim));
        }
    }
    return collapsed.length ? l2Normalize(collapsed) : null;
}

function _arrayLikeToFloat32(x) {
    if (x instanceof Float32Array) return new Float32Array(x); // copy so the caller's normalize doesn't mutate the pipeline's buffer
    if (Array.isArray(x) || ArrayBuffer.isView(x)) return Float32Array.from(x as any);
    return null;
}

/**
 * Reset the cached pipelines — used by tests + the `/api/ai/index/cancel`
 * path when an operator wants to swap models without restarting the process.
 */
export function _resetForTests() {
    _imagePipelinePromise = null;
    _textPipelinePromise = null;
}

/**
 * Exported for unit tests of the output-shape adapter — direct access
 * lets us probe each branch without spinning up Transformers.js.
 */
export const _internals = { toFloat32: _toFloat32 };

