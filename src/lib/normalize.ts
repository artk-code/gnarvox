// Text normalization (PLAN §7.2): turn raw lesson script into spoken-form text
// and record every substitution for the review UI.
//
// This is a sequential pipeline of rules. Each rule scans the working string,
// rewrites the patterns it owns, and appends NormalizationEdit records. Rules
// that emit lowercase words run before the acronym rule so generated words are
// never mistaken for acronyms.

import type { NormalizationEdit, NormalizationResult } from './types'
import {
  digitsToWords,
  numberToWords,
  ordinalToWords,
  yearToWords,
} from './numberWords'

const UNIT_WORDS: Record<string, [string, string]> = {
  // suffix -> [singular, plural]
  km: ['kilometer', 'kilometers'],
  kg: ['kilogram', 'kilograms'],
  mb: ['megabyte', 'megabytes'],
  gb: ['gigabyte', 'gigabytes'],
  tb: ['terabyte', 'terabytes'],
  ms: ['millisecond', 'milliseconds'],
  hz: ['hertz', 'hertz'],
}

// Common all-caps tokens that should be read as words, not spelled out.
const ACRONYM_WHITELIST = new Set([
  'NASA', 'OK', 'AM', 'PM', 'GNU', 'SQL', 'JSON', 'YAML', 'ASCII', 'GIF',
])

function cardinalGroups(intPart: string): string {
  return numberToWords(Number(intPart.replace(/,/g, '')))
}

interface Rule {
  name: string
  pattern: RegExp
  replace: (match: RegExpMatchArray) => string
}

const RULES: Rule[] = [
  {
    // Email addresses: alice@example.com -> "alice at example dot com".
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: (m) =>
      m[0]
        .replace(/@/g, ' at ')
        .replace(/\./g, ' dot ')
        .replace(/_/g, ' underscore ')
        .replace(/\s+/g, ' ')
        .trim(),
  },
  {
    // URLs: https://example.com/x -> "example dot com slash x".
    name: 'url',
    pattern: /\bhttps?:\/\/[^\s)]+/g,
    replace: (m) =>
      m[0]
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .replace(/\./g, ' dot ')
        .replace(/\//g, ' slash ')
        .replace(/-/g, ' dash ')
        .replace(/_/g, ' underscore ')
        .replace(/\s+/g, ' ')
        .trim(),
  },
  {
    // Currency: $1,234.50 -> "one thousand two hundred thirty-four dollars and fifty cents".
    name: 'currency',
    pattern: /\$(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g,
    replace: (m) => {
      const dollars = cardinalGroups(m[1])
      const dollarUnit = m[1].replace(/,/g, '') === '1' ? 'dollar' : 'dollars'
      if (m[2] && Number(m[2]) > 0) {
        const cents = numberToWords(Number(m[2]))
        const centUnit = Number(m[2]) === 1 ? 'cent' : 'cents'
        return `${dollars} ${dollarUnit} and ${cents} ${centUnit}`
      }
      return `${dollars} ${dollarUnit}`
    },
  },
  {
    // Percentages: 3.5% -> "three point five percent".
    name: 'percent',
    pattern: /(\d+)(?:\.(\d+))?%/g,
    replace: (m) => {
      const whole = numberToWords(Number(m[1]))
      const frac = m[2] ? ` point ${digitsToWords(m[2])}` : ''
      return `${whole}${frac} percent`
    },
  },
  {
    // Ordinals: 21st -> "twenty-first".
    name: 'ordinal',
    pattern: /\b(\d+)(st|nd|rd|th)\b/g,
    replace: (m) => ordinalToWords(Number(m[1])),
  },
  {
    // Number + unit: 5km -> "five kilometers".
    name: 'unit',
    pattern: new RegExp(
      `\\b(\\d+)\\s?(${Object.keys(UNIT_WORDS).join('|')})\\b`,
      'gi',
    ),
    replace: (m) => {
      const value = Number(m[1])
      const [singular, plural] = UNIT_WORDS[m[2].toLowerCase()]
      return `${numberToWords(value)} ${value === 1 ? singular : plural}`
    },
  },
  {
    // Decimals: 3.14 -> "three point one four".
    name: 'decimal',
    pattern: /\b(\d+)\.(\d+)\b/g,
    replace: (m) => `${numberToWords(Number(m[1]))} point ${digitsToWords(m[2])}`,
  },
  {
    // 4-digit years in a plausible range: 1999 -> "nineteen ninety-nine".
    name: 'year',
    pattern: /\b(1[5-9]\d{2}|20\d{2})\b/g,
    replace: (m) => yearToWords(Number(m[1])),
  },
  {
    // Remaining integers, including thousands separators: 1,234 -> words.
    name: 'integer',
    pattern: /\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g,
    replace: (m) => cardinalGroups(m[0]),
  },
  {
    // Ampersand to "and".
    name: 'ampersand',
    pattern: /\s&\s/g,
    replace: () => ' and ',
  },
  {
    // All-caps acronyms (2-5 letters) not in the read-as-word whitelist:
    // "API" -> "A P I". Whitelisted tokens are left as-is.
    name: 'acronym',
    pattern: /\b[A-Z]{2,5}\b/g,
    replace: (m) =>
      ACRONYM_WHITELIST.has(m[0]) ? m[0] : m[0].split('').join(' '),
  },
]

/** Collapse smart quotes / dashes / whitespace without recording edits. */
function cleanup(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\u00A0\u2007\u2009\u200A\u202F]/g, " ")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Normalize a block of lesson text. Returns the original text, the
 * spoken-form normalized text, and the list of substitutions made.
 */
export function normalizeText(input: string): NormalizationResult {
  const original = input
  let working = cleanup(input)
  const edits: NormalizationEdit[] = []

  for (const rule of RULES) {
    working = working.replace(rule.pattern, (...args) => {
      // String.replace passes (match, ...groups, offset, fullString); rebuild a
      // RegExpMatchArray-like view for the rule callback.
      const groups = args.slice(0, -2) as string[]
      const match = groups as unknown as RegExpMatchArray
      const replacement = rule.replace(match)
      if (replacement !== match[0]) {
        edits.push({ original: match[0], replacement, rule: rule.name })
      }
      return replacement
    })
  }

  // Final whitespace tidy after substitutions.
  const normalized = working.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()
  return { original, normalized, edits }
}
