import { describe, expect, it } from 'vitest'
import {
  digitsToWords,
  numberToWords,
  ordinalToWords,
  yearToWords,
} from './numberWords'

describe('numberToWords', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [13, 'thirteen'],
    [21, 'twenty-one'],
    [100, 'one hundred'],
    [234, 'two hundred thirty-four'],
    [1234, 'one thousand two hundred thirty-four'],
    [1000000, 'one million'],
    [2048, 'two thousand forty-eight'],
  ])('%i -> %s', (input, expected) => {
    expect(numberToWords(input)).toBe(expected)
  })
})

describe('ordinalToWords', () => {
  it.each([
    [1, 'first'],
    [2, 'second'],
    [3, 'third'],
    [5, 'fifth'],
    [12, 'twelfth'],
    [20, 'twentieth'],
    [21, 'twenty-first'],
  ])('%i -> %s', (input, expected) => {
    expect(ordinalToWords(input)).toBe(expected)
  })
})

describe('yearToWords', () => {
  it.each([
    [1999, 'nineteen ninety-nine'],
    [2026, 'twenty twenty-six'],
    [2000, 'two thousand'],
    [2005, 'two thousand five'],
    [1900, 'nineteen hundred'],
    [1905, 'nineteen oh five'],
  ])('%i -> %s', (input, expected) => {
    expect(yearToWords(input)).toBe(expected)
  })
})

describe('digitsToWords', () => {
  it('reads each digit', () => {
    expect(digitsToWords('314')).toBe('three one four')
  })
})
