import { describe, expect, it } from 'vitest'
import {
  computePeak,
  computeRms,
  computeWaveformPeaks,
  encodeWav,
  linearToDb,
  normalizeLoudness,
  stitch,
} from './audio'

describe('peak and rms', () => {
  it('computes peak and rms', () => {
    const s = new Float32Array([1, -1, 1, -1])
    expect(computePeak(s)).toBe(1)
    expect(computeRms(s)).toBeCloseTo(1, 5)
  })
})

describe('linearToDb', () => {
  it('maps amplitude to dB', () => {
    expect(linearToDb(1)).toBeCloseTo(0, 5)
    expect(linearToDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(linearToDb(0)).toBe(-Infinity)
  })
})

describe('normalizeLoudness', () => {
  it('honors the peak ceiling', () => {
    const s = new Float32Array([1, -1, 1, -1]) // rms 1, peak 1
    const out = normalizeLoudness(s, 1.0, 0.708) // rmsGain 1 vs peakGain 0.708
    expect(computePeak(out)).toBeCloseTo(0.708, 3)
  })

  it('hits the target rms when below the ceiling', () => {
    const s = new Float32Array([1, -1, 1, -1])
    const out = normalizeLoudness(s, 0.5, 0.708)
    expect(computeRms(out)).toBeCloseTo(0.5, 3)
  })

  it('returns silence unchanged', () => {
    const s = new Float32Array([0, 0, 0])
    expect(Array.from(normalizeLoudness(s, 0.5))).toEqual([0, 0, 0])
  })
})

describe('stitch', () => {
  it('concatenates segments with no pause', () => {
    const out = stitch(
      [
        { samples: new Float32Array([1, 1, 1]), pauseMsAfter: 0 },
        { samples: new Float32Array([2, 2]), pauseMsAfter: 0 },
      ],
      1000,
    )
    expect(Array.from(out)).toEqual([1, 1, 1, 2, 2])
  })

  it('inserts silence for pauseMsAfter', () => {
    const out = stitch(
      [{ samples: new Float32Array([1, 1]), pauseMsAfter: 1000 }],
      1000,
    )
    expect(out.length).toBe(1002) // 2 samples + 1000ms @ 1000Hz
    expect(out[2]).toBe(0)
  })
})

describe('computeWaveformPeaks', () => {
  it('produces the requested number of buckets', () => {
    const s = new Float32Array(1000).map((_, i) => Math.sin(i))
    expect(computeWaveformPeaks(s, 50)).toHaveLength(50)
  })
})

describe('encodeWav', () => {
  it('writes a valid RIFF/WAVE header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1])
    const buffer = encodeWav(samples, 24000)
    const view = new DataView(buffer)
    const tag = (off: number) =>
      String.fromCharCode(
        view.getUint8(off),
        view.getUint8(off + 1),
        view.getUint8(off + 2),
        view.getUint8(off + 3),
      )
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(36)).toBe('data')
    expect(view.getUint32(24, true)).toBe(24000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(buffer.byteLength).toBe(44 + samples.length * 2)
    expect(view.getUint32(40, true)).toBe(samples.length * 2) // data size
  })
})
