import { describe, expect, it } from 'vitest'
import { computePeak } from './audio'
import { deriveSeed, renderChunkPCM, voiceBaseHz, VOICES } from './engine'

const opts = { sampleRate: 24000, voiceId: 'art', seed: 1234, pace: 1 }

describe('renderChunkPCM', () => {
  it('is deterministic for the same input', () => {
    const a = renderChunkPCM('Hello there, this is a test.', opts)
    const b = renderChunkPCM('Hello there, this is a test.', opts)
    expect(a.samples.length).toBe(b.samples.length)
    expect(Array.from(a.samples.slice(0, 200))).toEqual(
      Array.from(b.samples.slice(0, 200)),
    )
    expect(a.seedUsed).toBe(b.seedUsed)
  })

  it('changes with the seed', () => {
    const a = renderChunkPCM('Hello there.', opts)
    const b = renderChunkPCM('Hello there.', { ...opts, seed: 9999 })
    expect(a.seedUsed).not.toBe(b.seedUsed)
  })

  it('produces audible, non-clipping audio', () => {
    const { samples } = renderChunkPCM('A short narrated sentence here.', opts)
    expect(samples.length).toBeGreaterThan(0)
    const peak = computePeak(samples)
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(1)
  })
})

describe('voices', () => {
  it('exposes built-in voice profiles', () => {
    expect(VOICES.length).toBeGreaterThan(0)
    expect(voiceBaseHz('art')).toBeGreaterThan(0)
    expect(voiceBaseHz('unknown')).toBe(120)
  })

  it('derives a stable per-chunk seed', () => {
    expect(deriveSeed('abc', opts)).toBe(deriveSeed('abc', opts))
    expect(deriveSeed('abc', opts)).not.toBe(deriveSeed('abd', opts))
  })
})
