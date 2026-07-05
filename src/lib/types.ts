// Shared domain types for gnarvox Studio.
//
// These mirror the durable workflow primitives described in docs/PLAN.md
// (sections, chunks, normalized text, generation, takes, provenance) but in a
// deliberately small, offline, single-file-project shape suitable for a
// browser-only demo. No SQLite, no Tauri host — just enough structure to make
// the lesson-narration workflow real and reproducible.

/** A normalization edit applied to the raw script, surfaced for review. */
export interface NormalizationEdit {
  /** Original substring as written in the script. */
  original: string
  /** Spoken-form replacement gnarvox will feed to the voice engine. */
  replacement: string
  /** Rule that fired (e.g. "currency", "ordinal", "acronym"). */
  rule: string
}

/** Result of normalizing a block of script text. */
export interface NormalizationResult {
  /** Text exactly as the user wrote it. */
  original: string
  /** Text after normalization, ready for chunking + synthesis. */
  normalized: string
  /** Every substitution made, for the review UI. */
  edits: NormalizationEdit[]
}

/** A model-facing unit of text (1–4 sentences), the granularity we generate. */
export interface Chunk {
  id: string
  /** Index within the whole lesson, stable across regeneration. */
  index: number
  /** Normalized, spoken-form text for this chunk. */
  text: string
  /** Character count, used for the "safe chunk size" warnings. */
  charCount: number
  /** Pause to insert after this chunk, in milliseconds. */
  pauseMsAfter: number
}

/** A user-facing grouping of chunks, derived from headings / blank lines. */
export interface Section {
  id: string
  index: number
  /** Heading text if the section came from a markdown heading. */
  title: string
  chunks: Chunk[]
}

/** Status of a chunk in the generation queue. */
export type ChunkStatus =
  | 'pending'
  | 'generating'
  | 'succeeded'
  | 'failed_retryable'

/** A generated rendering of one chunk (the plan calls these "takes"). */
export interface Take {
  chunkId: string
  /** Seed actually used, so the take is reproducible. */
  seed: number
  /** Mono PCM samples in [-1, 1]. */
  samples: Float32Array
  sampleRate: number
  durationSec: number
  /** Real-time factor = render time / audio duration (cosmetic for the demo). */
  rtf: number
  /** Peak sample magnitude, for clipping warnings. */
  peak: number
  /** RMS level, for loudness reporting. */
  rms: number
  warnings: string[]
}

/** Which voice engine renders chunks. */
export type EngineId = 'synthetic' | 'kokoro'

/** Where Kokoro model files are downloaded from. */
export interface ModelSource {
  /** 'huggingface' uses the official hub; 'custom' uses `customBaseUrl`. */
  host: 'huggingface' | 'custom'
  /** Base URL of a mirror or self-hosted file server (used when host==='custom'). */
  customBaseUrl: string
  /** HF-style repo id of the Kokoro ONNX model. */
  repoId: string
  /** Quantization / precision variant to download and run. */
  dtype: 'q8' | 'fp16' | 'q4' | 'q4f16' | 'fp32'
}

/** Settings that drive synthesis + stitching + export. */
export interface StudioSettings {
  /** Active voice engine. */
  engineId: EngineId
  /** Kokoro voice id (e.g. "af_heart"), used when engineId === 'kokoro'. */
  kokoroVoice: string
  /** Voice profile id (selects a deterministic synth timbre). */
  voiceId: string
  /** Base seed; combined per-chunk so each chunk is independently reproducible. */
  seed: number
  /** Speaking pace multiplier (1.0 = default). */
  pace: number
  /** Target chunk size in characters. */
  targetChunkChars: number
  /** Inter-chunk pause in milliseconds. */
  interChunkPauseMs: number
  /** Inter-section pause in milliseconds. */
  interSectionPauseMs: number
  /** Target RMS for loudness normalization (linear, ~ -20 dBFS by default). */
  targetRms: number
}
