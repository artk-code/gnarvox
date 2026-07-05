// Kokoro-82M neural TTS engine (kokoro-js + onnxruntime-web, 100% local).
//
// This module is loaded lazily (dynamic import) so the heavy transformers.js
// bundle never affects startup when the synthetic engine is active.
//
// Offline behavior:
// - The ONNX runtime WASM ships inside the app bundle (no CDN).
// - The 28 voice embeddings ship as app assets; kokoro-js's hard-coded
//   Hugging Face voice URL is redirected to them via a scoped fetch patch.
// - Model weights are downloaded once — explicitly, never silently — into the
//   app's model store (Tauri: <appData>/models; browser: Cache API), from the
//   official repo, a custom mirror, or imported from a local folder.

import { KokoroTTS, type GenerateOptions } from 'kokoro-js'
import { env } from '@huggingface/transformers'
import type { ModelSource } from '../types'
import { resolveHost } from '../models/modelSource'
import { getModelStore } from '../models/modelStore'

// The ONNX runtime (wasm + module loader) ships as app assets under ort/
// (see the localInferenceAssetsPlugin in vite.config.ts) instead of a CDN.

export interface DownloadProgress {
  file: string
  loaded: number
  total: number
}

export type ProgressCallback = (p: DownloadProgress) => void

let fetchPatched = false

/** Redirect kokoro-js's hard-coded HF voice URLs to the bundled voice files. */
function patchVoiceFetch(): void {
  if (fetchPatched) return
  fetchPatched = true
  const original = globalThis.fetch.bind(globalThis)
  const voiceRe = /^https:\/\/huggingface\.co\/.+\/resolve\/main\/voices\/([a-z]+_[a-z]+)\.bin$/
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const m = url.match(voiceRe)
    if (m) {
      return original(`${import.meta.env.BASE_URL}kokoro-voices/${m[1]}.bin`, init)
    }
    return original(input as RequestInfo, init)
  }) as typeof fetch
}

let envConfigured = false

function configureEnv(): void {
  if (!envConfigured) {
    envConfigured = true
    patchVoiceFetch()
    // Local ORT runtime, no CDN. Absolute URL so workers resolve it too.
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = new URL(
        `${import.meta.env.BASE_URL}ort/`,
        document.baseURI,
      ).href
    }
    // Model ids always resolve through our store + remote host, never a
    // local dev server path.
    env.allowLocalModels = false
    // Route all model file reads/writes through the gnarvox model store.
    env.useBrowserCache = false
    env.useCustomCache = true
    env.customCache = getModelStore()
  }
}

interface LoadedEngine {
  key: string
  tts: KokoroTTS
}

let loaded: LoadedEngine | null = null

function engineKey(source: ModelSource): string {
  return `${source.repoId}|${source.dtype}`
}

export interface LoadOptions {
  /**
   * Allow fetching missing files from the network. When false, loading only
   * succeeds if every file is already in the model store (no silent
   * downloads, PLAN §12.3).
   */
  allowDownload: boolean
  onProgress?: ProgressCallback
}

/** Load (or return the already-loaded) Kokoro engine for a model source. */
export async function loadKokoro(
  source: ModelSource,
  opts: LoadOptions,
): Promise<KokoroTTS> {
  configureEnv()
  const key = engineKey(source)
  if (loaded && loaded.key === key) return loaded.tts

  env.remoteHost = resolveHost(source)
  env.remotePathTemplate = '{model}/resolve/{revision}/'
  env.allowRemoteModels = opts.allowDownload

  const tts = await KokoroTTS.from_pretrained(source.repoId, {
    dtype: source.dtype,
    device: 'wasm',
    progress_callback: (p: unknown) => {
      const info = p as { status?: string; file?: string; loaded?: number; total?: number }
      if (info.status === 'progress' && info.file) {
        opts.onProgress?.({
          file: info.file,
          loaded: info.loaded ?? 0,
          total: info.total ?? 0,
        })
      }
    },
  })

  loaded = { key, tts }
  return tts
}

/** Drop the in-memory engine (e.g. after the model was deleted). */
export function unloadKokoro(): void {
  loaded = null
}

/** Naive linear resampler; Kokoro natively outputs 24 kHz so this is a no-op
 *  in practice, but keeps the pipeline safe if that ever changes. */
function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const ratio = from / to
  const out = new Float32Array(Math.round(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, samples.length - 1)
    out[i] = samples[i0] + (samples[i1] - samples[i0]) * (pos - i0)
  }
  return out
}

export interface KokoroRenderOptions {
  voice: string
  pace: number
  sampleRate: number
}

/** Render one chunk of text to mono PCM using the loaded Kokoro engine. */
export async function renderKokoroChunk(
  tts: KokoroTTS,
  text: string,
  opts: KokoroRenderOptions,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const audio = await tts.generate(text, {
    // kokoro-js's voice union type is stricter than our persisted string.
    voice: opts.voice as GenerateOptions['voice'],
    speed: opts.pace,
  })
  const samples = resample(
    audio.audio as Float32Array,
    audio.sampling_rate,
    opts.sampleRate,
  )
  return { samples, sampleRate: opts.sampleRate }
}
