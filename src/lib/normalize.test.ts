import { describe, expect, it } from 'vitest'
import { normalizeText } from './normalize'

const norm = (s: string) => normalizeText(s).normalized

describe('normalizeText', () => {
  it('expands currency with cents', () => {
    expect(norm('It costs $1,234.50 total.')).toBe(
      'It costs one thousand two hundred thirty-four dollars and fifty cents total.',
    )
  })

  it('expands whole-dollar amounts', () => {
    expect(norm('Just $50 per hour.')).toBe('Just fifty dollars per hour.')
  })

  it('expands percentages including decimals', () => {
    expect(norm('Roughly 95% done')).toBe('Roughly ninety-five percent done')
    expect(norm('about 3.5% noise')).toBe('about three point five percent noise')
  })

  it('expands ordinals', () => {
    expect(norm('The 1st and 21st rules')).toBe('The first and twenty-first rules')
  })

  it('expands decimals and units', () => {
    expect(norm('pi is 3.14')).toBe('pi is three point one four')
    expect(norm('128GB of memory')).toBe('one hundred twenty-eight gigabytes of memory')
  })

  it('reads four-digit years', () => {
    expect(norm('Back in 1999')).toBe('Back in nineteen ninety-nine')
    expect(norm('By 2026 things changed')).toBe('By twenty twenty-six things changed')
  })

  it('expands plain integers with separators', () => {
    expect(norm('There are 1,000 items')).toBe('There are one thousand items')
  })

  it('speaks emails and URLs', () => {
    expect(norm('mail hello@arthurkaiser.com now')).toBe(
      'mail hello at arthurkaiser dot com now',
    )
    expect(norm('see https://lessons.example.com/voice here')).toBe(
      'see lessons dot example dot com slash voice here',
    )
  })

  it('spells out non-whitelisted acronyms but keeps whitelisted ones', () => {
    expect(norm('the API and TTS')).toBe('the A P I and T T S')
    expect(norm('using JSON here')).toBe('using JSON here')
  })

  it('records edits with rule names', () => {
    const result = normalizeText('In 1999 it cost $50.')
    const rules = result.edits.map((e) => e.rule)
    expect(rules).toContain('year')
    expect(rules).toContain('currency')
    expect(result.original).toBe('In 1999 it cost $50.')
  })
})
