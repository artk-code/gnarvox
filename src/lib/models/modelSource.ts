// Model source resolution for the Kokoro engine (PLAN §12.3).
//
// A ModelSource describes *where* the Kokoro ONNX model files come from:
// the official Hugging Face repo (default), a custom mirror / self-hosted
// base URL, or files imported from local disk into the app's model store.
// Pure helpers only — no network, no Tauri — so this is unit-testable.

import type { ModelSource } from '../types'

export const DEFAULT_MODEL_SOURCE: ModelSource = {
  host: 'huggingface',
  customBaseUrl: '',
  repoId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  dtype: 'q8',
}

/**
 * Curated Hugging Face repos known to work with the in-app engine. Any other
 * repo id can be entered too, as long as it is a Kokoro/StyleTTS2-family ONNX
 * export laid out like these (config.json + tokenizer + onnx/model*.onnx);
 * pre-flight validation checks that before downloading.
 */
export const KNOWN_MODELS: Array<{ repoId: string; label: string }> = [
  {
    repoId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    label: 'Kokoro-82M v1.0 — English, 28 voices (recommended)',
  },
  {
    repoId: 'onnx-community/Kokoro-82M-ONNX',
    label: 'Kokoro-82M v0.19 — English (older release)',
  },
]

export const HF_HOST = 'https://huggingface.co/'

/** dtype → ONNX file inside the repo's onnx/ folder (transformers.js naming). */
export const DTYPE_FILES: Record<ModelSource['dtype'], string> = {
  fp32: 'onnx/model.onnx',
  fp16: 'onnx/model_fp16.onnx',
  q8: 'onnx/model_quantized.onnx',
  q4: 'onnx/model_q4.onnx',
  q4f16: 'onnx/model_q4f16.onnx',
}

/** Rough download sizes for the UI (Kokoro-82M v1.0). */
export const DTYPE_INFO: Array<{
  dtype: ModelSource['dtype']
  label: string
}> = [
  { dtype: 'q8', label: 'q8 — ~92 MB, recommended (near-fp32 quality)' },
  { dtype: 'fp16', label: 'fp16 — ~163 MB' },
  { dtype: 'q4', label: 'q4 — ~154 MB' },
  { dtype: 'q4f16', label: 'q4f16 — ~147 MB' },
  { dtype: 'fp32', label: 'fp32 — ~326 MB, full precision' },
]

/** Small metadata files every variant needs, besides the ONNX weights. */
export const META_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json']

/** All files a given source needs on disk before the engine can load offline. */
export function requiredFiles(source: ModelSource): string[] {
  return [...META_FILES, DTYPE_FILES[source.dtype]]
}

/** Base URL model files are fetched from (transformers.js `remoteHost`). */
export function resolveHost(source: ModelSource): string {
  if (source.host === 'custom' && source.customBaseUrl.trim()) {
    const url = source.customBaseUrl.trim()
    return url.endsWith('/') ? url : `${url}/`
  }
  return HF_HOST
}

/** Full download URL of one file within the repo. */
export function fileUrl(source: ModelSource, file: string): string {
  return `${resolveHost(source)}${source.repoId}/resolve/main/${file}`
}

/**
 * Host-independent cache key for a downloaded model file, so a model pulled
 * from a mirror is recognized as the same model afterwards. Falls back to a
 * sanitized form of the full URL for non-repo files.
 */
export function cacheKeyForUrl(url: string): string {
  const m = url.match(/^https?:\/\/[^/]+\/(.+?)\/resolve\/[^/]+\/(.+?)(?:\?.*)?$/)
  if (m) return `${m[1]}/${m[2]}`
  return url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '')
}

/** Cache key for a (source, file) pair. */
export function cacheKey(source: ModelSource, file: string): string {
  return `${source.repoId}/${file}`
}

/** Sanitize a cache key into a relative filesystem path (Tauri model store).
 *  Strips empty and dot-only segments so keys can never escape the store dir. */
export function keyToRelPath(key: string): string {
  return key
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, '_'))
    .filter((part) => part !== '' && !/^\.+$/.test(part))
    .join('/')
}
