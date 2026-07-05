// End-to-end pipeline test: exercises the whole offline workflow the GUI drives
// (normalize -> chunk -> render each chunk -> stitch -> loudness -> WAV) and
// asserts a real, valid WAV with audible content comes out. This is the
// non-UI proof that "Generate lesson" + "Download WAV" actually work.

import { describe, expect, it } from 'vitest'
import { normalizeText } from './normalize'
import { chunkScript, flattenChunks } from './chunk'
import { renderChunkPCM } from './engine'
import {
  computePeak,
  computeRms,
  encodeWav,
  normalizeLoudness,
  stitch,
} from './audio'
import type { StudioSettings } from './types'

const settings: StudioSettings = {
  engineId: 'synthetic',
  kokoroVoice: 'af_heart',
  voiceId: 'art',
  seed: 1234,
  pace: 1,
  targetChunkChars: 200,
  interChunkPauseMs: 300,
  interSectionPauseMs: 800,
  targetRms: 0.11,
}

const SCRIPT = `# Lesson 1

Welcome back. In 1999 this cost $1,000, but by 2026 it is basically free. We aim for 95% accuracy.

# Lesson 2

Email me at hello@example.com or visit https://example.com/docs for the 1st draft.`

describe('full generation pipeline', () => {
  it('turns a script into a valid, audible WAV', () => {
    const sampleRate = 24000

    const normalization = normalizeText(SCRIPT)
    // Normalization actually changed the text.
    expect(normalization.edits.length).toBeGreaterThan(0)
    expect(normalization.normalized).toContain('nineteen ninety-nine')
    expect(normalization.normalized).toContain('one thousand dollars')

    const sections = chunkScript(normalization.normalized, settings)
    expect(sections).toHaveLength(2)

    const chunks = flattenChunks(sections)
    expect(chunks.length).toBeGreaterThan(0)

    const segments = chunks.map((chunk) => {
      const rendered = renderChunkPCM(chunk.text, {
        sampleRate,
        voiceId: settings.voiceId,
        seed: settings.seed,
        pace: settings.pace,
      })
      expect(rendered.samples.length).toBeGreaterThan(0)
      return { samples: rendered.samples, pauseMsAfter: chunk.pauseMsAfter }
    })

    const raw = stitch(segments, sampleRate)
    const finalAudio = normalizeLoudness(raw, settings.targetRms)

    // Audible and not clipping.
    expect(computePeak(finalAudio)).toBeGreaterThan(0)
    expect(computePeak(finalAudio)).toBeLessThanOrEqual(0.708 + 1e-6)
    expect(computeRms(finalAudio)).toBeGreaterThan(0)

    // Several seconds of narration.
    expect(finalAudio.length / sampleRate).toBeGreaterThan(2)

    // Valid WAV container.
    const wav = encodeWav(finalAudio, sampleRate)
    const view = new DataView(wav)
    const tag = (off: number) =>
      String.fromCharCode(
        view.getUint8(off),
        view.getUint8(off + 1),
        view.getUint8(off + 2),
        view.getUint8(off + 3),
      )
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(wav.byteLength).toBe(44 + finalAudio.length * 2)
  })
})
