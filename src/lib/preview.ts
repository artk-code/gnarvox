// One-shot PCM preview playback for per-chunk audition buttons.
//
// Uses a single lazily-created AudioContext shared across previews so we don't
// leak contexts. Returns a stop() handle for the caller.

let ctx: AudioContext | null = null
let active: AudioBufferSourceNode | null = null

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

export function stopPreview(): void {
  if (active) {
    active.onended = null
    try {
      active.stop()
    } catch {
      // already stopped
    }
    active.disconnect()
    active = null
  }
}

/** Play a mono Float32 buffer once. Returns a stop handle. */
export function playPcm(
  samples: Float32Array,
  sampleRate: number,
  onEnded?: () => void,
): () => void {
  const audioCtx = ensureCtx()
  void audioCtx.resume()
  stopPreview()

  const buffer = audioCtx.createBuffer(1, samples.length, sampleRate)
  buffer.copyToChannel(new Float32Array(samples), 0)
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.connect(audioCtx.destination)
  source.onended = () => {
    if (active === source) active = null
    onEnded?.()
  }
  source.start()
  active = source
  return stopPreview
}
