// Central app state for gnarvox Studio.
//
// Holds the script, settings, normalization result, sections/chunks, generated
// takes, queue status, and the final stitched + loudness-normalized audio. The
// generation action renders each chunk with the deterministic synth engine,
// yielding between chunks so the queue UI updates like a real job queue.

import { create } from 'zustand'
import {
  computePeak,
  computeRms,
  computeWaveformPeaks,
  normalizeLoudness,
  stitch,
} from './lib/audio'
import { chunkScript, flattenChunks } from './lib/chunk'
import { renderChunkPCM } from './lib/engine'
import { normalizeText } from './lib/normalize'
import type {
  ChunkStatus,
  NormalizationResult,
  Section,
  StudioSettings,
  Take,
} from './lib/types'

export const SAMPLE_RATE = 24000
const WAVEFORM_BUCKETS = 1400

export const DEFAULT_SETTINGS: StudioSettings = {
  voiceId: 'art',
  seed: 1234,
  pace: 1,
  targetChunkChars: 240,
  interChunkPauseMs: 320,
  interSectionPauseMs: 900,
  targetRms: 0.11, // ≈ -19 dBFS, within the ACX -23..-18 dB RMS window
}

export const SAMPLE_SCRIPT = `# Welcome to Lessons with Art

Hi, I'm Art. Today's lesson covers 3 big ideas, and by the end you'll have built something real. We'll move fast, but I'll repeat the important parts.

Quick housekeeping: this lesson is about 12 minutes long, and the project files live at https://lessons.example.com/voice. If you get stuck, email me at hello@arthurkaiser.com and I'll help.

# Lesson 1: Why local-first matters

Back in 1999, running a model like this needed a server room. By 2026, a single laptop with 128GB of memory can do it on your desk. That's a 1000x change in what's possible.

The 1st rule is simple: keep your data on your own machine. The 2nd rule is to make every result reproducible. Roughly 95% of debugging pain comes from results you can't reproduce.

# Lesson 2: Measure before you optimize

Don't guess. Generate a 10 minute sample, measure the loudness, and only then tune. Aim for an RMS around -20 dB and a peak no higher than -3 dB.

A good narrator costs $0 in API fees when everything runs locally. The savings add up: at $50 per hour of cloud TTS, 40 lessons would cost $2,000.

That's the whole lesson. Thanks for listening, and I'll see you in the next one.`

interface StudioState {
  scriptText: string
  settings: StudioSettings
  normalization: NormalizationResult | null
  sections: Section[]
  takes: Record<string, Take>
  status: Record<string, ChunkStatus>
  stitched: {
    samples: Float32Array
    sampleRate: number
    peaks: Float32Array
    rms: number
    peak: number
    durationSec: number
  } | null
  isGenerating: boolean
  progress: { done: number; total: number }
  generatedAt: string | null

  setScriptText: (text: string) => void
  loadSample: () => void
  updateSettings: (patch: Partial<StudioSettings>) => void
  analyze: () => void
  generateAll: () => Promise<void>
  reset: () => void
}

const yieldToUi = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

export const useStudio = create<StudioState>((set, get) => ({
  scriptText: SAMPLE_SCRIPT,
  settings: DEFAULT_SETTINGS,
  normalization: null,
  sections: [],
  takes: {},
  status: {},
  stitched: null,
  isGenerating: false,
  progress: { done: 0, total: 0 },
  generatedAt: null,

  setScriptText: (text) => set({ scriptText: text }),

  loadSample: () => {
    set({ scriptText: SAMPLE_SCRIPT })
    get().analyze()
  },

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  analyze: () => {
    const { scriptText, settings } = get()
    const normalization = normalizeText(scriptText)
    const sections = chunkScript(normalization.normalized, settings)
    const status: Record<string, ChunkStatus> = {}
    for (const chunk of flattenChunks(sections)) status[chunk.id] = 'pending'
    set({
      normalization,
      sections,
      status,
      takes: {},
      stitched: null,
      generatedAt: null,
      progress: { done: 0, total: flattenChunks(sections).length },
    })
  },

  generateAll: async () => {
    // Ensure analysis is current before generating.
    if (get().sections.length === 0) get().analyze()
    const { sections, settings } = get()
    const chunks = flattenChunks(sections)
    if (chunks.length === 0) return

    set({
      isGenerating: true,
      takes: {},
      stitched: null,
      progress: { done: 0, total: chunks.length },
      status: Object.fromEntries(chunks.map((c) => [c.id, 'pending' as ChunkStatus])),
    })

    const takes: Record<string, Take> = {}
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      set((s) => ({ status: { ...s.status, [chunk.id]: 'generating' } }))
      await yieldToUi()

      const start = performance.now()
      const rendered = renderChunkPCM(chunk.text, {
        sampleRate: SAMPLE_RATE,
        voiceId: settings.voiceId,
        seed: settings.seed,
        pace: settings.pace,
      })
      const elapsedSec = (performance.now() - start) / 1000
      const durationSec = rendered.samples.length / rendered.sampleRate
      const peak = computePeak(rendered.samples)
      const rms = computeRms(rendered.samples)
      const warnings: string[] = []
      if (peak >= 0.99) warnings.push('possible clipping')
      if (durationSec < 0.4) warnings.push('very short chunk')

      takes[chunk.id] = {
        chunkId: chunk.id,
        seed: rendered.seedUsed,
        samples: rendered.samples,
        sampleRate: rendered.sampleRate,
        durationSec,
        rtf: durationSec > 0 ? elapsedSec / durationSec : 0,
        peak,
        rms,
        warnings,
      }

      set((s) => ({
        takes: { ...s.takes, [chunk.id]: takes[chunk.id] },
        status: { ...s.status, [chunk.id]: 'succeeded' },
        progress: { done: i + 1, total: chunks.length },
      }))
    }

    // Stitch with pauses, then loudness-normalize the whole lesson.
    const segments = chunks.map((c) => ({
      samples: takes[c.id].samples,
      pauseMsAfter: c.pauseMsAfter,
    }))
    const raw = stitch(segments, SAMPLE_RATE)
    const normalized = normalizeLoudness(raw, settings.targetRms)
    const peaks = computeWaveformPeaks(normalized, WAVEFORM_BUCKETS)

    set({
      stitched: {
        samples: normalized,
        sampleRate: SAMPLE_RATE,
        peaks,
        rms: computeRms(normalized),
        peak: computePeak(normalized),
        durationSec: normalized.length / SAMPLE_RATE,
      },
      isGenerating: false,
      generatedAt: new Date().toISOString(),
    })
  },

  reset: () =>
    set({
      scriptText: SAMPLE_SCRIPT,
      settings: DEFAULT_SETTINGS,
      normalization: null,
      sections: [],
      takes: {},
      status: {},
      stitched: null,
      isGenerating: false,
      progress: { done: 0, total: 0 },
      generatedAt: null,
    }),
}))
