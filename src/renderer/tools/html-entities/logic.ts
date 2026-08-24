/**
 * Pure HTML entity encoding/decoding and slug generation. Decoding is a
 * text-only transform — markup is never parsed or executed.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  plusmn: '±',
  sup2: '²',
  sup3: '³',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  sect: '§',
  para: '¶',
  dagger: '†',
  permil: '‰'
}

/** Characters that must always be escaped, mapped to their named entities. */
const MUST_ESCAPE: Array<[string, string]> = [
  ['&', 'amp'],
  ['<', 'lt'],
  ['>', 'gt'],
  ['"', 'quot'],
  ["'", 'apos']
]

const DECODE_RE = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g
const NAME_BY_CHAR: Record<string, string> = {}
for (const [name, char] of Object.entries(NAMED_ENTITIES)) {
  if (!(char in NAME_BY_CHAR)) NAME_BY_CHAR[char] = name
}

/** Escape & < > " ' plus non-ASCII characters (named where known, else numeric). */
export function encodeEntities(input: string): string {
  let output = ''
  for (const char of input) {
    const forced = MUST_ESCAPE.find(([raw]) => raw === char)
    if (forced) {
      output += `&${forced[1]};`
      continue
    }
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint < 128) {
      output += char
    } else {
      const name = NAME_BY_CHAR[char]
      output += name ? `&${name};` : `&#${codePoint};`
    }
  }
  return output
}

/** Decode named and numeric entities back to plain text; unknown entities pass through. */
export function decodeEntities(input: string): string {
  return input.replace(DECODE_RE, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hex = /^#[xX]/.test(body)
      const codePoint = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(codePoint) || codePoint > 0x10ffff || codePoint < 0) return entity
      // Control characters that HTML never renders are left untouched.
      if (codePoint < 32 || (codePoint >= 127 && codePoint <= 159)) return entity
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return entity
      }
    }
    const decoded = NAMED_ENTITIES[body.toLowerCase()]
    return decoded ?? entity
  })
}

/** Lowercase URL-safe slug with diacritics folded ("Café" → "cafe"). */
export function slugify(input: string): string {
  const folded = input.normalize('NFD').replace(/\p{M}/gu, '')
  return folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}
