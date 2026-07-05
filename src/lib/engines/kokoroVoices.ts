// Static catalog of Kokoro-82M v1.0 voices (bundled with the app; the voice
// embedding .bin files ship as app assets so voice selection works offline).

export interface KokoroVoice {
  id: string
  label: string
}

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: 'af_heart', label: 'Heart — American female (best)' },
  { id: 'af_bella', label: 'Bella — American female' },
  { id: 'af_nicole', label: 'Nicole — American female (whisper)' },
  { id: 'af_aoede', label: 'Aoede — American female' },
  { id: 'af_kore', label: 'Kore — American female' },
  { id: 'af_sarah', label: 'Sarah — American female' },
  { id: 'af_alloy', label: 'Alloy — American female' },
  { id: 'af_jessica', label: 'Jessica — American female' },
  { id: 'af_nova', label: 'Nova — American female' },
  { id: 'af_river', label: 'River — American female' },
  { id: 'af_sky', label: 'Sky — American female' },
  { id: 'am_michael', label: 'Michael — American male' },
  { id: 'am_fenrir', label: 'Fenrir — American male' },
  { id: 'am_puck', label: 'Puck — American male' },
  { id: 'am_adam', label: 'Adam — American male' },
  { id: 'am_echo', label: 'Echo — American male' },
  { id: 'am_eric', label: 'Eric — American male' },
  { id: 'am_liam', label: 'Liam — American male' },
  { id: 'am_onyx', label: 'Onyx — American male' },
  { id: 'am_santa', label: 'Santa — American male' },
  { id: 'bf_emma', label: 'Emma — British female' },
  { id: 'bf_isabella', label: 'Isabella — British female' },
  { id: 'bf_alice', label: 'Alice — British female' },
  { id: 'bf_lily', label: 'Lily — British female' },
  { id: 'bm_george', label: 'George — British male' },
  { id: 'bm_fable', label: 'Fable — British male' },
  { id: 'bm_lewis', label: 'Lewis — British male' },
  { id: 'bm_daniel', label: 'Daniel — British male' },
]

export function kokoroVoiceLabel(id: string): string {
  return KOKORO_VOICES.find((v) => v.id === id)?.label ?? id
}
