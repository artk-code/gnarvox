// Central app state for gnarvox Studio.
//
// Holds the script, settings, normalization result, sections/chunks, generated
// takes, queue status, and the final stitched + loudness-normalized audio. The
// generation action renders each chunk with the active voice engine (the
// deterministic synth or the local Kokoro neural TTS), yielding between chunks
// so the queue UI updates like a real job queue. Settings and the model source
// persist across launches.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { withTimeout } from './lib/async'
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
import { DEFAULT_MODEL_SOURCE } from './lib/models/modelSource'
import type {
  ChunkStatus,
  ModelSource,
  NormalizationResult,
  Section,
  StudioSettings,
  Take,
} from './lib/types'

export const SAMPLE_RATE = 24000
const WAVEFORM_BUCKETS = 1400

export const DEFAULT_SETTINGS: StudioSettings = {
  engineId: 'synthetic',
  kokoroVoice: 'af_heart',
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
  modelSource: ModelSource
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
  /** Set while the Kokoro model is being loaded into memory (first use). */
  isLoadingEngine: boolean
  generationError: string | null
  progress: { done: number; total: number }
  generatedAt: string | null

  setScriptText: (text: string) => void
  loadSample: () => void
  updateSettings: (patch: Partial<StudioSettings>) => void
  updateModelSource: (patch: Partial<ModelSource>) => void
  analyze: () => void
  generateAll: () => Promise<void>
  cancelGeneration: () => void
  clearError: () => void
  reset: () => void
}

const yieldToUi = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

/** How long one chunk may render before we assume the engine is wedged. */
const CHUNK_RENDER_TIMEOUT_MS = 120_000
/** How long loading the model into memory may take (wasm compile included). */
const ENGINE_LOAD_TIMEOUT_MS = 180_000

/** Cancellation token for the in-flight generation run, if any. */
let activeRun: { cancelled: boolean } | null = null

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      scriptText: SAMPLE_SCRIPT,
      settings: DEFAULT_SETTINGS,
      modelSource: DEFAULT_MODEL_SOURCE,
      normalization: null,
      sections: [],
      takes: {},
      status: {},
      stitched: null,
      isGenerating: false,
      isLoadingEngine: false,
      generationError: null,
      progress: { done: 0, total: 0 },
      generatedAt: null,

      setScriptText: (text) => set({ scriptText: text }),

      loadSample: () => {
        set({ scriptText: SAMPLE_SCRIPT })
        get().analyze()
      },

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      updateModelSource: (patch) =>
        set((s) => ({ modelSource: { ...s.modelSource, ...patch } })),

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
          generationError: null,
          progress: { done: 0, total: flattenChunks(sections).length },
        })
      },

      generateAll: async () => {
        if (get().isGenerating) return
        // Ensure analysis is current before generating.
        if (get().sections.length === 0) get().analyze()
        const { sections, settings, modelSource } = get()
        const chunks = flattenChunks(sections)
        if (chunks.length === 0) return

        const run = { cancelled: false }
        activeRun = run

        set({
          isGenerating: true,
          generationError: null,
          takes: {},
          stitched: null,
          progress: { done: 0, total: chunks.length },
          status: Object.fromEntries(
            chunks.map((c) => [c.id, 'pending' as ChunkStatus]),
          ),
        })

        // Everything below runs inside try/finally: whatever goes wrong (or
        // however slow the engine is), the UI always gets unlocked again.
        try {
          // Resolve the active engine into a per-chunk render function.
          let renderChunk: (
            text: string,
          ) => Promise<{ samples: Float32Array; sampleRate: number; seed: number }>

          if (settings.engineId === 'kokoro') {
            set({ isLoadingEngine: true })
            try {
              const { loadKokoro, renderKokoroChunk } = await import(
                './lib/engines/kokoro'
              )
              // Never downloads silently: only loads from the local model
              // store. Bounded so a wedged load cannot freeze the app.
              const tts = await withTimeout(
                loadKokoro(modelSource, { allowDownload: false }),
                ENGINE_LOAD_TIMEOUT_MS,
                'Loading the Kokoro model',
              )
              renderChunk = async (text) => {
                const out = await renderKokoroChunk(tts, text, {
                  voice: settings.kokoroVoice,
                  pace: settings.pace,
                  sampleRate: SAMPLE_RATE,
                })
                return { ...out, seed: 0 }
              }
            } catch (err) {
              set({
                generationError:
                  'The Kokoro model is not installed yet (or failed to load). ' +
                  'Open the Voice engine panel to download or import it. ' +
                  `Details: ${err instanceof Error ? err.message : String(err)}`,
              })
              return
            } finally {
              set({ isLoadingEngine: false })
            }
          } else {
            renderChunk = async (text) => {
              const rendered = renderChunkPCM(text, {
                sampleRate: SAMPLE_RATE,
                voiceId: settings.voiceId,
                seed: settings.seed,
                pace: settings.pace,
              })
              return {
                samples: rendered.samples,
                sampleRate: rendered.sampleRate,
                seed: rendered.seedUsed,
              }
            }
          }

          const takes: Record<string, Take> = {}
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            if (run.cancelled) {
              set({ generationError: 'Generation cancelled.' })
              return
            }
            set((s) => ({ status: { ...s.status, [chunk.id]: 'generating' } }))
            await yieldToUi()

            const start = performance.now()
            let rendered: { samples: Float32Array; sampleRate: number; seed: number }
            try {
              rendered = await withTimeout(
                renderChunk(chunk.text),
                CHUNK_RENDER_TIMEOUT_MS,
                `Rendering chunk ${i + 1}`,
              )
            } catch (err) {
              set((s) => ({
                status: { ...s.status, [chunk.id]: 'failed_retryable' },
                generationError: `Chunk ${i + 1} failed to render: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              }))
              return
            }
            const elapsedSec = (performance.now() - start) / 1000
            const durationSec = rendered.samples.length / rendered.sampleRate
            const peak = computePeak(rendered.samples)
            const rms = computeRms(rendered.samples)
            const warnings: string[] = []
            if (peak >= 0.99) warnings.push('possible clipping')
            if (durationSec < 0.4) warnings.push('very short chunk')

            takes[chunk.id] = {
              chunkId: chunk.id,
              seed: rendered.seed,
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
            generatedAt: new Date().toISOString(),
          })
        } catch (err) {
          // Safety net for anything the paths above did not anticipate.
          set({
            generationError: `Generation failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          })
        } finally {
          if (activeRun === run) activeRun = null
          set({ isGenerating: false, isLoadingEngine: false })
        }
      },

      cancelGeneration: () => {
        if (activeRun) activeRun.cancelled = true
      },

      clearError: () => set({ generationError: null }),

      reset: () =>
        set({
          scriptText: SAMPLE_SCRIPT,
          settings: DEFAULT_SETTINGS,
          modelSource: DEFAULT_MODEL_SOURCE,
          normalization: null,
          sections: [],
          takes: {},
          status: {},
          stitched: null,
          isGenerating: false,
          isLoadingEngine: false,
          generationError: null,
          progress: { done: 0, total: 0 },
          generatedAt: null,
        }),
    }),
    {
      name: 'gnarvox-studio',
      version: 1,
      partialize: (s) => ({ settings: s.settings, modelSource: s.modelSource }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<
          Pick<StudioState, 'settings' | 'modelSource'>
        >
        return {
          ...current,
          settings: { ...current.settings, ...p.settings },
          modelSource: { ...current.modelSource, ...p.modelSource },
        }
      },
    },
  ),
)
