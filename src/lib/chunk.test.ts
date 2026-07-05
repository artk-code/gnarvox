import { describe, expect, it } from 'vitest'
import { chunkScript, flattenChunks, splitSentences } from './chunk'
import type { StudioSettings } from './types'

const settings: StudioSettings = {
  engineId: 'synthetic',
  kokoroVoice: 'af_heart',
  voiceId: 'art',
  seed: 1,
  pace: 1,
  targetChunkChars: 240,
  interChunkPauseMs: 300,
  interSectionPauseMs: 900,
  targetRms: 0.1,
}

describe('splitSentences', () => {
  it('splits on sentence terminators', () => {
    expect(splitSentences('Hi there. How are you? Great!')).toEqual([
      'Hi there.',
      'How are you?',
      'Great!',
    ])
  })
})

describe('chunkScript', () => {
  it('creates a section per heading', () => {
    const sections = chunkScript(
      '# Intro\n\nHello world. This is a test.\n\n# Part Two\n\nMore text here.',
      settings,
    )
    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('Intro')
    expect(sections[1].title).toBe('Part Two')
  })

  it('assigns the inter-section pause to the last chunk of a section', () => {
    const sections = chunkScript(
      '# A\n\nA long opening sentence well past the minimum length threshold here.\n\n# B\n\nAnother long closing sentence also past the minimum length threshold here.',
      settings,
    )
    for (const section of sections) {
      const last = section.chunks[section.chunks.length - 1]
      expect(last.pauseMsAfter).toBe(settings.interSectionPauseMs)
    }
  })

  it('packs sentences up to the target size', () => {
    const small: StudioSettings = { ...settings, targetChunkChars: 90 }
    const sections = chunkScript(
      'This first sentence is long enough to fill an entire chunk on its own here. Two.',
      small,
    )
    // The tiny trailing "Two." merges back into the preceding chunk.
    expect(sections).toHaveLength(1)
    expect(sections[0].chunks).toHaveLength(1)
    expect(sections[0].chunks[0].text).toContain('Two.')
  })

  it('flattens chunks in document order with stable ids', () => {
    const sections = chunkScript(
      '# One\n\nAlpha sentence number one is sufficiently long to be a chunk here.\n\n# Two\n\nBeta sentence number two is also sufficiently long to be a chunk.',
      settings,
    )
    const chunks = flattenChunks(sections)
    expect(chunks.map((c) => c.id)).toEqual(['s0-c0', 's1-c0'])
  })

  it('handles scripts with no headings', () => {
    const sections = chunkScript('Just a plain paragraph with no heading at all.', settings)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('')
    expect(sections[0].chunks).toHaveLength(1)
  })
})
