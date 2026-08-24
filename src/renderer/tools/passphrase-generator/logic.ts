/**
 * Secure passphrase and password generation using the platform CSPRNG.
 * Pure helpers kept separate for deterministic testing; all randomness flows
 * through rejection-sampled crypto.getRandomValues draws (no modulo bias).
 */

/** 256 short common English words — one full 8-bit index, diceware-style. */
export const WORDLIST: readonly string[] = [
  'ant',
  'acorn',
  'agent',
  'album',
  'alien',
  'almond',
  'amber',
  'anchor',
  'angle',
  'ankle',
  'apple',
  'apron',
  'arch',
  'arctic',
  'argon',
  'armor',
  'arrow',
  'artist',
  'ash',
  'aspen',
  'atlas',
  'atom',
  'aunt',
  'autumn',
  'avocado',
  'axis',
  'azure',
  'bacon',
  'badge',
  'bagel',
  'baker',
  'ballad',
  'bamboo',
  'banana',
  'banjo',
  'barrel',
  'basil',
  'basket',
  'batch',
  'beach',
  'beacon',
  'beam',
  'bean',
  'beard',
  'beast',
  'bed',
  'beetle',
  'bench',
  'berry',
  'bicycle',
  'birch',
  'bird',
  'bison',
  'black',
  'blade',
  'blanket',
  'blaze',
  'blink',
  'bloom',
  'blossom',
  'blue',
  'board',
  'boat',
  'bolt',
  'bone',
  'bonus',
  'book',
  'boost',
  'boot',
  'border',
  'bottle',
  'boulder',
  'bowl',
  'box',
  'brave',
  'bread',
  'breeze',
  'brick',
  'bridge',
  'bright',
  'broom',
  'brush',
  'bubble',
  'bucket',
  'bugle',
  'bulb',
  'bunch',
  'cabin',
  'cable',
  'cactus',
  'camel',
  'candle',
  'canoe',
  'canvas',
  'canyon',
  'captain',
  'cargo',
  'carrot',
  'castle',
  'cedar',
  'celery',
  'chain',
  'chalk',
  'charm',
  'cheese',
  'cherry',
  'chess',
  'chief',
  'chill',
  'chip',
  'choir',
  'cider',
  'circle',
  'citrus',
  'clamp',
  'clay',
  'clerk',
  'cliff',
  'climb',
  'cloak',
  'clock',
  'cloth',
  'cloud',
  'clover',
  'coach',
  'coast',
  'cobalt',
  'cocoa',
  'coffee',
  'coin',
  'comet',
  'compass',
  'copper',
  'coral',
  'cork',
  'corn',
  'couch',
  'coyote',
  'crane',
  'crater',
  'crayon',
  'cream',
  'creek',
  'crest',
  'cricket',
  'crown',
  'crumb',
  'crust',
  'cube',
  'cupcake',
  'curve',
  'cyan',
  'daisy',
  'dance',
  'dawn',
  'deck',
  'delta',
  'desert',
  'diamond',
  'dice',
  'diner',
  'ditch',
  'diver',
  'dock',
  'dolphin',
  'dome',
  'donkey',
  'donut',
  'dove',
  'dragon',
  'dream',
  'drift',
  'drum',
  'duck',
  'dune',
  'dusk',
  'eagle',
  'earth',
  'easel',
  'echo',
  'edge',
  'elbow',
  'elder',
  'elf',
  'elm',
  'ember',
  'emu',
  'engine',
  'epoch',
  'ether',
  'exit',
  'extra',
  'fabric',
  'falcon',
  'family',
  'fang',
  'farm',
  'feather',
  'fence',
  'ferry',
  'fiber',
  'fiddle',
  'field',
  'fig',
  'filter',
  'finch',
  'finger',
  'fire',
  'flame',
  'flare',
  'flask',
  'fleet',
  'flint',
  'float',
  'flock',
  'floor',
  'flower',
  'flute',
  'foam',
  'fog',
  'forest',
  'fork',
  'fossil',
  'frame',
  'frost',
  'fruit',
  'fudge',
  'funnel',
  'gadget',
  'galaxy',
  'garden',
  'garlic',
  'gauge',
  'gecko',
  'giant',
  'ginger',
  'glacier',
  'glass',
  'glove',
  'goat',
  'gold',
  'granite',
  'grape',
  'gravel',
  'green',
  'grove',
  'guitar',
  'gum',
  'harbor',
  'harvest',
  'hazel',
  'heart',
  'hedge',
  'helium',
  'herb',
  'iris'
]

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'

export const SYMBOL_SET = '!@#$%^&*-_=+?'

/** Uniform random integer in [0, maxExclusive) via rejection sampling. */
export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new RangeError('maxExclusive must be positive')
  const range = 0x100000000
  const limit = range - (range % maxExclusive)
  const buf = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % maxExclusive
}

function pickChar(charset: string): string {
  return charset[randomInt(charset.length)]
}

export interface PassphraseOptions {
  words?: number
  separator?: string
  capitalize?: boolean
  appendNumber?: boolean
}

/**
 * Build a passphrase of `words` dictionary words joined by `separator`,
 * optionally Title-Casing each word and appending two random digits.
 */
export function generatePassphrase(options: PassphraseOptions = {}): string {
  const count = Math.max(1, options.words ?? 4)
  const separator = options.separator ?? '-'
  const capitalize = options.capitalize ?? true
  const appendNumber = options.appendNumber ?? true

  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    const word = WORDLIST[randomInt(WORDLIST.length)]
    picked.push(capitalize ? word[0].toUpperCase() + word.slice(1) : word)
  }
  let out = picked.join(separator)
  if (appendNumber) {
    out += String(randomInt(100)).padStart(2, '0')
  }
  return out
}

export interface PasswordOptions {
  upper?: boolean
  digits?: boolean
  symbols?: boolean
}

/**
 * Build a random password of `length` chars that always contains lowercase
 * letters plus at least one char from every selected class, shuffled with a
 * CSPRNG Fisher–Yates so required chars aren't predictably placed.
 */
export function generatePassword(length: number, options: PasswordOptions = {}): string {
  const upper = options.upper ?? true
  const digits = options.digits ?? true
  const symbols = options.symbols ?? true

  const classes: string[] = [LOWER]
  if (upper) classes.push(UPPER)
  if (digits) classes.push(DIGITS)
  if (symbols) classes.push(SYMBOL_SET)

  if (!Number.isInteger(length) || length < classes.length || length > 256) {
    throw new RangeError(`Password length must be an integer between ${classes.length} and 256.`)
  }

  const alphabet = classes.join('')
  const chars: string[] = classes.map(pickChar)
  while (chars.length < length) {
    chars.push(pickChar(alphabet))
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export type EntropyRequest =
  { mode: 'words'; words: number } | { mode: 'chars'; length: number; alphabetSize: number }

/** Entropy in bits: log2 of the keyspace actually being drawn from. */
export function entropyBits(request: EntropyRequest): number {
  if (request.mode === 'words') return request.words * Math.log2(WORDLIST.length)
  if (request.alphabetSize <= 1) return 0
  return request.length * Math.log2(request.alphabetSize)
}

export type StrengthLabel = 'Weak' | 'Fair' | 'Strong' | 'Excellent'

/** Threshold bands chosen so everyday passphrases land mid-scale. */
export function strengthLabel(bits: number): StrengthLabel {
  if (bits < 45) return 'Weak'
  if (bits < 60) return 'Fair'
  if (bits < 80) return 'Strong'
  return 'Excellent'
}
