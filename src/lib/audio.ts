// Audio analysis + assembly utilities (PLAN §7.4, §7.10).
//
// All pure functions over Float32 PCM: peak/RMS measurement, loudness
// normalization with a peak ceiling (ACX-style), chunk stitching with silence
// pauses, waveform peak buckets for the canvas display, and 16-bit WAV encoding
// for export. No Web Audio dependency, so everything is testable in Node.

/** Peak (max absolute sample) of a buffer. */
export function computePeak(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }
  return peak
}

/** RMS level of a buffer (linear amplitude). */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/** Linear amplitude to dBFS. */
export function linearToDb(value: number): number {
  return value <= 0 ? -Infinity : 20 * Math.log10(value)
}

/**
 * Normalize a buffer toward a target RMS, clamped so the peak never exceeds
 * `peakCeiling` (default -3 dBFS ≈ 0.708, the ACX peak limit). Returns a new
 * buffer; the input is not mutated.
 */
export function normalizeLoudness(
  samples: Float32Array,
  targetRms: number,
  peakCeiling = 0.708,
): Float32Array {
  const rms = computeRms(samples)
  const peak = computePeak(samples)
  if (rms === 0 || peak === 0) return samples.slice()

  const rmsGain = targetRms / rms
  const peakGain = peakCeiling / peak
  const gain = Math.min(rmsGain, peakGain)

  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

export interface StitchSegment {
  samples: Float32Array
  pauseMsAfter: number
}

/**
 * Concatenate rendered chunks into a single buffer, inserting silence after
 * each according to its pauseMsAfter.
 */
export function stitch(segments: StitchSegment[], sampleRate: number): Float32Array {
  let total = 0
  for (const seg of segments) {
    total += seg.samples.length + Math.round((seg.pauseMsAfter / 1000) * sampleRate)
  }
  const out = new Float32Array(total)
  let offset = 0
  for (const seg of segments) {
    out.set(seg.samples, offset)
    offset += seg.samples.length + Math.round((seg.pauseMsAfter / 1000) * sampleRate)
  }
  return out
}

/**
 * Downsample a buffer to `buckets` peak values for waveform rendering.
 * Each output value is the max absolute sample within its bucket.
 */
export function computeWaveformPeaks(samples: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets)
  if (samples.length === 0) return out
  const size = samples.length / buckets
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size)
    const end = Math.min(samples.length, Math.floor((b + 1) * size))
    let peak = 0
    for (let i = start; i < end; i++) {
      const a = Math.abs(samples[i])
      if (a > peak) peak = a
    }
    out[b] = peak
  }
  return out
}

/** Encode mono Float32 PCM as a 16-bit little-endian WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true) // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true) // block align
  view.setUint16(34, 8 * bytesPerSample, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, Math.round(clamped * 0x7fff), true)
    offset += 2
  }
  return buffer
}
