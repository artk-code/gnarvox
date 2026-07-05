// Derived project manifest (PLAN §6.3, §9.2): a self-describing export record
// binding the audio to its text, settings, per-chunk seeds, consent, and a
// content hash. In the full product SQLite is authoritative and this is a
// regenerated artifact; here it is generated directly at export time.

import { linearToDb } from './audio'
import { sha256Hex } from './hash'
import type { Section, StudioSettings, Take } from './types'
import { VOICES } from './engine'
import { kokoroVoiceLabel } from './engines/kokoroVoices'

export const APP_VERSION = '0.3.0'
export const ENGINE_ID = 'gnarvox-synth'
export const ENGINE_VERSION = '0.1.0'

export interface ManifestArgs {
  createdAt: string
  settings: StudioSettings
  sections: Section[]
  takes: Record<string, Take>
  wavBytes: Uint8Array
  durationSec: number
  rms: number
  peak: number
}

export interface Manifest {
  app: string
  appVersion: string
  createdAt: string
  engine: { id: string; version: string; type: string }
  voice: { id: string; label: string }
  consent: { owner: string; statement: string }
  settings: StudioSettings
  sections: Array<{
    title: string
    chunks: Array<{
      id: string
      text: string
      seed: number
      durationSec: number
      rmsDb: number
      peakDb: number
    }>
  }>
  export: {
    format: string
    sampleRate: number
    durationSec: number
    rmsDb: number
    peakDb: number
    sha256: string
  }
  notes: string[]
}

export async function buildManifest(args: ManifestArgs): Promise<Manifest> {
  const kokoro = args.settings.engineId === 'kokoro'
  const voice = VOICES.find((v) => v.id === args.settings.voiceId)
  const sha256 = await sha256Hex(args.wavBytes)

  const sections = args.sections.map((section) => ({
    title: section.title,
    chunks: section.chunks.map((chunk) => {
      const take = args.takes[chunk.id]
      return {
        id: chunk.id,
        text: chunk.text,
        seed: take?.seed ?? 0,
        durationSec: Number((take?.durationSec ?? 0).toFixed(3)),
        rmsDb: Number(linearToDb(take?.rms ?? 0).toFixed(1)),
        peakDb: Number(linearToDb(take?.peak ?? 0).toFixed(1)),
      }
    }),
  }))

  return {
    app: 'gnarvox-studio',
    appVersion: APP_VERSION,
    createdAt: args.createdAt,
    engine: kokoro
      ? { id: 'kokoro-82m-v1.0-onnx', version: '1.0', type: 'neural-tts-local' }
      : { id: ENGINE_ID, version: ENGINE_VERSION, type: 'synthetic-offline' },
    voice: kokoro
      ? {
          id: args.settings.kokoroVoice,
          label: kokoroVoiceLabel(args.settings.kokoroVoice),
        }
      : {
          id: voice?.id ?? args.settings.voiceId,
          label: voice?.label ?? 'unknown',
        },
    consent: {
      owner: 'Art Kaiser',
      statement: kokoro
        ? 'Narration synthesized locally by the open Kokoro-82M TTS model (Apache-2.0) via gnarvox Studio. No human voice was cloned.'
        : 'Synthetic demo narration generated locally by gnarvox Studio. No human voice was cloned; audio is procedurally generated.',
    },
    settings: args.settings,
    sections,
    export: {
      format: 'wav',
      sampleRate: 24000,
      durationSec: Number(args.durationSec.toFixed(3)),
      rmsDb: Number(linearToDb(args.rms).toFixed(1)),
      peakDb: Number(linearToDb(args.peak).toFixed(1)),
      sha256,
    },
    notes: [
      'gnarvox Studio is an offline demo of the gnarvox lesson-narration workflow.',
      'The synthetic engine is reproducible: same text + voice + seed => identical audio.',
      'See docs/PLAN.md for the full local voice-cloning product design.',
    ],
  }
}
