// Optional live voice preview via the browser SpeechSynthesis API.
//
// This is a *fun extra*: when running in a real browser, the chunk-preview
// button can speak the text aloud in a real system voice. It is never required
// — the deterministic synth engine (lib/engine.ts) is the source of truth for
// generated/exported audio, and works with no speech support at all.

export function isSpeechAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'speechSynthesis' in globalThis &&
    typeof (globalThis as { SpeechSynthesisUtterance?: unknown })
      .SpeechSynthesisUtterance === 'function'
  )
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onEnd?: () => void
}

/** Speak text aloud. Returns true if speech was started. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!isSpeechAvailable()) return false
  const synth = globalThis.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = opts.rate ?? 1
  utterance.pitch = opts.pitch ?? 1
  if (opts.onEnd) utterance.onend = opts.onEnd
  synth.speak(utterance)
  return true
}

export function cancelSpeech(): void {
  if (isSpeechAvailable()) globalThis.speechSynthesis.cancel()
}
