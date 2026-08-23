import { describe, expect, it } from 'vitest'
import { formatDigest, HASH_ALGORITHMS, HEX_LENGTH_BY_ALGORITHM, isPlausibleDigest } from './logic'

describe('HASH_ALGORITHMS', () => {
  it('exposes exactly the supported algorithms', () => {
    expect(HASH_ALGORITHMS.map((a) => a.id)).toEqual(['md5', 'sha1', 'sha256', 'sha512'])
    expect(HASH_ALGORITHMS.every((a) => a.label.length > 0)).toBe(true)
  })
})

describe('HEX_LENGTH_BY_ALGORITHM', () => {
  it('matches the standard digest widths in bits / 4', () => {
    expect(HEX_LENGTH_BY_ALGORITHM).toEqual({ md5: 32, sha1: 40, sha256: 64, sha512: 128 })
  })
})

describe('formatDigest', () => {
  it('normalizes to lowercase by default regardless of input case', () => {
    expect(formatDigest('ABCDEF0123')).toBe('abcdef0123')
    expect(formatDigest('AbCdEf')).toBe('abcdef')
  })

  it('uppercases on request', () => {
    expect(formatDigest('abcdef', { upper: true })).toBe('ABCDEF')
  })

  it('returns empty string for empty input (boundary)', () => {
    expect(formatDigest('')).toBe('')
  })
})

describe('isPlausibleDigest', () => {
  it.each([
    ['md5', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['sha1', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
    ['sha256', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']
  ] as const)('accepts the known %s digest of an empty input', (algorithm, digest) => {
    expect(isPlausibleDigest(digest, algorithm)).toBe(true)
  })

  it('rejects wrong lengths and non-hex characters', () => {
    expect(isPlausibleDigest('abc', 'md5')).toBe(false)
    expect(isPlausibleDigest('z'.repeat(32), 'md5')).toBe(false)
    // sha256 digest checked against md5 width.
    expect(
      isPlausibleDigest('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'md5')
    ).toBe(false)
  })

  it('rejects empty input for every algorithm', () => {
    for (const algorithm of ['md5', 'sha1', 'sha256', 'sha512'] as const) {
      expect(isPlausibleDigest('', algorithm)).toBe(false)
    }
  })
})
