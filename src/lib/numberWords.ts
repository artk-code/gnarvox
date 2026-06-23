// Cardinal / ordinal / year number-to-words conversion.
//
// Lesson scripts are full of numbers, and every TTS engine mishandles some of
// them, so gnarvox normalizes them to spoken form up front (see PLAN §7.2).
// These functions are pure and exhaustively unit-tested.

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty',
  'ninety',
]
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion']

function twoDigitToWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = TENS[Math.floor(n / 10)]
  const ones = n % 10
  return ones ? `${tens}-${ONES[ones]}` : tens
}

function threeDigitToWords(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rem = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`)
  if (rem) parts.push(twoDigitToWords(rem))
  return parts.join(' ')
}

/** Convert a non-negative integer (up to trillions) to spoken words. */
export function numberToWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return String(value)
  const n = Math.floor(value)
  if (n === 0) return 'zero'

  const groups: number[] = []
  let remaining = n
  while (remaining > 0) {
    groups.push(remaining % 1000)
    remaining = Math.floor(remaining / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue
    const scale = SCALES[i]
    parts.push(scale ? `${threeDigitToWords(group)} ${scale}` : threeDigitToWords(group))
  }
  return parts.join(' ')
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
}

function toOrdinalToken(token: string): string {
  if (ORDINAL_IRREGULAR[token]) return ORDINAL_IRREGULAR[token]
  if (token.endsWith('y')) return `${token.slice(0, -1)}ieth`
  return `${token}th`
}

/** Convert a non-negative integer to its ordinal words ("21" -> "twenty-first"). */
export function ordinalToWords(value: number): string {
  const words = numberToWords(value)
  const spaceIdx = words.lastIndexOf(' ')
  const head = spaceIdx === -1 ? '' : words.slice(0, spaceIdx + 1)
  const last = spaceIdx === -1 ? words : words.slice(spaceIdx + 1)
  const hyphenIdx = last.lastIndexOf('-')
  if (hyphenIdx === -1) return head + toOrdinalToken(last)
  return `${head}${last.slice(0, hyphenIdx + 1)}${toOrdinalToken(last.slice(hyphenIdx + 1))}`
}

/** Read a 4-digit year the way a narrator would ("1999" -> "nineteen ninety-nine"). */
export function yearToWords(year: number): string {
  if (year < 1000 || year > 9999) return numberToWords(year)
  const hi = Math.floor(year / 100)
  const lo = year % 100

  // 2000-2009 read as "two thousand (n)".
  if (year >= 2000 && year < 2010) {
    return lo === 0 ? 'two thousand' : `two thousand ${ONES[lo]}`
  }
  // Even centuries: "nineteen hundred", "two thousand".
  if (lo === 0) {
    return year % 1000 === 0 ? numberToWords(year) : `${twoDigitToWords(hi)} hundred`
  }
  // Otherwise pair the centuries with the remainder ("nineteen oh five").
  const tail = lo < 10 ? `oh ${ONES[lo]}` : twoDigitToWords(lo)
  return `${twoDigitToWords(hi)} ${tail}`
}

/** Read each digit individually ("314" -> "three one four"), for decimals. */
export function digitsToWords(digits: string): string {
  return digits
    .split('')
    .filter((c) => c >= '0' && c <= '9')
    .map((c) => ONES[Number(c)])
    .join(' ')
}
