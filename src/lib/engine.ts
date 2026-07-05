// gnarvox synthetic voice engine.
//
// This is the offline, no-model, no-keys stand-in for a real TTS backend
// (Chatterbox / Kokoro in the full plan). It deterministically renders a chunk
// of text to speech-like PCM using simple DSP: a glottal-ish harmonic tone with
// per-syllable amplitude pulses, prosodic pitch jitter, sentence declination,
// and consonant noise bursts. Same text + settings + seed => identical audio,
// which keeps every "take" reproducible (PLAN §17) and unit-testable in Node.
//
// It is intentionally not trying to be intelligible — it is a fun, recognizable
// "narration" placeholder that exercises the whole workflow end to end. A real
// voice preview is layered on top via the browser SpeechSynthesis API
// (see lib/speech.ts); that path is optional and never required.

import { hashString } from './hash'

export interface RenderOptions {
  sampleRate: number
  voiceId: string
  seed: number
  pace: number
}

export interface RenderedAudio {
  samples: Float32Array
  sampleRate: number
  seedUsed: number
}

export interface VoiceProfile {
  id: string
  label: string
  /** Base fundamental frequency in Hz. */
  baseHz: number
}

/** Built-in deterministic "voices" (timbres), all local and synthetic. */
export const VOICES: VoiceProfile[] = [
  { id: 'art', label: 'Art (warm baritone)', baseHz: 116 },
  { id: 'clara', label: 'Clara (bright alto)', baseHz: 196 },
  { id: 'rolf', label: 'Rolf (deep narrator)', baseHz: 92 },
]

export function voiceBaseHz(voiceId: string): number {
  return VOICES.find((v) => v.id === voiceId)?.baseHz ?? 120
}

/** Small fast deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function estimateSyllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouy]+/g)
  return Math.max(1, groups ? groups.length : 1)
}

const HARMONICS = [1, 0.5, 0.32, 0.18, 0.1]

/** Derive the per-chunk seed from voice + base seed + text. */
export function deriveSeed(text: string, opts: RenderOptions): number {
  return hashString(`${opts.voiceId}|${opts.seed}|${text}`)
}

/**
 * Deterministically render a chunk of text to mono PCM in [-1, 1].
 * Pure: no Date, no Math.random, no Web Audio — safe to run in tests.
 */
export function renderChunkPCM(text: string, opts: RenderOptions): RenderedAudio {
  const sr = opts.sampleRate
  const pace = opts.pace > 0 ? opts.pace : 1
  const seedUsed = deriveSeed(text, opts)
  const rng = mulberry32(seedUsed)
  const base = voiceBaseHz(opts.voiceId)

  const words = text.split(/\s+/).filter(Boolean)
  const out: number[] = []
  let phase = 0 // continuous phase to avoid inter-sample clicks

  // Lead-in silence so the very first word does not start abruptly.
  pushSilence(out, Math.round(sr * 0.04))

  let sentencePos = 0 // 0..1 progress through the current sentence (declination)
  for (const rawWord of words) {
    const core = rawWord.replace(/[^A-Za-z0-9']/g, '')
    const trailing = rawWord.slice(core.length)
    const syllables = estimateSyllables(core || rawWord)
    const wordDur = Math.min(1.4, syllables * (0.17 / pace))
    const totalSamples = Math.max(1, Math.round(wordDur * sr))

    // Pitch: voice base, prosodic jitter, gentle declination across a sentence.
    const jitter = 1 + (rng() - 0.5) * 0.22
    const declination = 1 - 0.14 * sentencePos
    const f0 = base * jitter * declination

    for (let i = 0; i < totalSamples; i++) {
      const t = i / totalSamples // 0..1 within word
      // Per-syllable amplitude pulses + word attack/release envelope.
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * syllables * t))
      const attack = Math.min(1, (i / sr) / 0.012)
      const release = Math.min(1, ((totalSamples - i) / sr) / 0.03)
      const env = pulse * attack * release

      // Slight vibrato.
      const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * 5 * (i / sr))
      const f = f0 * vibrato
      phase += (2 * Math.PI * f) / sr

      let voiced = 0
      for (let k = 0; k < HARMONICS.length; k++) {
        voiced += HARMONICS[k] * Math.sin(phase * (k + 1))
      }
      voiced /= 2.2 // normalize harmonic sum

      // Brief consonant-like noise burst at word onset.
      const consonant =
        i < sr * 0.01 ? (rng() - 0.5) * 0.5 * (1 - i / (sr * 0.01)) : 0

      out.push(env * (voiced * 0.7 + consonant) * 0.6)
    }

    // Inter-word / punctuation pause.
    let gap = 0.05
    if (/[,;:]/.test(trailing)) gap = 0.16
    if (/[.!?]/.test(trailing)) gap = 0.3
    pushSilence(out, Math.round(sr * gap))

    if (/[.!?]/.test(trailing)) {
      sentencePos = 0
    } else {
      sentencePos = Math.min(1, sentencePos + 0.12)
    }
  }

  return { samples: Float32Array.from(out), sampleRate: sr, seedUsed }
}

function pushSilence(out: number[], n: number): void {
  for (let i = 0; i < n; i++) out.push(0)
}
