// Sectioning + chunking (PLAN §7.3): split normalized lesson text into
// user-facing sections (from headings / paragraphs) and model-facing chunks
// (1–4 sentences, ~targetChunkChars), preferring semantic boundaries and
// avoiding very short inputs that trigger TTS hallucination.

import type { Chunk, Section, StudioSettings } from './types'

/** Smallest chunk we keep on its own; shorter trailing chunks merge upward. */
const MIN_CHUNK_CHARS = 60

interface Block {
  type: 'heading' | 'para'
  text: string
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let buffer: string[] = []
  const flush = () => {
    const para = buffer.join(' ').trim()
    if (para) blocks.push({ type: 'para', text: para })
    buffer = []
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const heading = /^#{1,6}\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', text: heading[1].trim() })
    } else if (line === '') {
      flush()
    } else {
      buffer.push(line)
    }
  }
  flush()
  return blocks
}

/** Split a paragraph into sentences, keeping the terminator with the sentence. */
export function splitSentences(paragraph: string): string[] {
  // Break after . ! ? when followed by whitespace and a capital / quote / digit.
  return paragraph
    .split(/(?<=[.!?])\s+(?=["'(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface RawSection {
  title: string
  paragraphs: string[]
}

function foldSections(blocks: Block[]): RawSection[] {
  const sections: RawSection[] = []
  let current: RawSection | null = null
  for (const block of blocks) {
    if (block.type === 'heading') {
      current = { title: block.text, paragraphs: [] }
      sections.push(current)
    } else {
      if (!current) {
        current = { title: '', paragraphs: [] }
        sections.push(current)
      }
      current.paragraphs.push(block.text)
    }
  }
  // Drop heading-only sections with no spoken content.
  return sections.filter((s) => s.title || s.paragraphs.length > 0)
}

function packSentences(sentences: string[], target: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (!current) {
      current = sentence
    } else if (current.length + 1 + sentence.length <= target) {
      current = `${current} ${sentence}`
    } else {
      chunks.push(current)
      current = sentence
    }
  }
  if (current) chunks.push(current)

  // Merge a too-short trailing chunk into its predecessor.
  if (chunks.length >= 2 && chunks[chunks.length - 1].length < MIN_CHUNK_CHARS) {
    const tail = chunks.pop() as string
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${tail}`
  }
  return chunks
}

function pauseFor(text: string, isSectionEnd: boolean, settings: StudioSettings): number {
  if (isSectionEnd) return settings.interSectionPauseMs
  // Shorter pause when a chunk ends mid-thought (comma / no terminal punctuation).
  return /[.!?]"?$/.test(text.trim())
    ? settings.interChunkPauseMs
    : Math.round(settings.interChunkPauseMs * 0.6)
}

/**
 * Build sections + chunks from normalized lesson text. Chunk ids are derived
 * from section/chunk indices so they stay stable across regeneration.
 */
export function chunkScript(normalized: string, settings: StudioSettings): Section[] {
  const rawSections = foldSections(toBlocks(normalized))
  const target = Math.max(MIN_CHUNK_CHARS, settings.targetChunkChars)

  return rawSections.map((raw, si) => {
    const sentences = raw.paragraphs.flatMap(splitSentences)
    const texts = packSentences(sentences, target)
    const chunks: Chunk[] = texts.map((text, ci) => ({
      id: `s${si}-c${ci}`,
      index: ci,
      text,
      charCount: text.length,
      pauseMsAfter: pauseFor(text, ci === texts.length - 1, settings),
    }))
    return {
      id: `s${si}`,
      index: si,
      title: raw.title,
      chunks,
    }
  })
}

/** Flatten sections into the ordered chunk list used by the generation queue. */
export function flattenChunks(sections: Section[]): Chunk[] {
  return sections.flatMap((s) => s.chunks)
}
