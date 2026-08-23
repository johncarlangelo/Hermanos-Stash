import { describe, expect, it } from 'vitest'
import { formatUuid, isValidUuidV4, MAX_UUID_BATCH } from './logic'

describe('formatUuid', () => {
  const sample = '123e4567-e89b-42d3-a456-426614174000'

  it('passes through lowercase by default', () => {
    expect(formatUuid(sample, { uppercase: false, braces: false })).toBe(sample)
  })

  it('uppercases when requested', () => {
    expect(formatUuid(sample, { uppercase: true, braces: false })).toBe(sample.toUpperCase())
  })

  it('wraps in braces when requested', () => {
    expect(formatUuid(sample, { uppercase: false, braces: true })).toBe(`{${sample}}`)
  })
})

describe('isValidUuidV4', () => {
  it('accepts canonical v4 layout (version nibble 4, variant 8/9/a/b)', () => {
    expect(isValidUuidV4('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
    expect(isValidUuidV4('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true)
  })

  it('rejects other versions and malformed strings', () => {
    expect(isValidUuidV4('f47ac10b-58cc-1372-a567-0e02b2c3d479')).toBe(false) // version 1
    expect(isValidUuidV4('f47ac10b-58cc-4372-c567-0e02b2c3d479')).toBe(false) // bad variant
    expect(isValidUuidV4('not-a-uuid')).toBe(false)
    expect(isValidUuidV4('')).toBe(false)
  })
})

describe('MAX_UUID_BATCH', () => {
  it('bounds generation to a sane maximum', () => {
    expect(MAX_UUID_BATCH).toBeGreaterThan(0)
    expect(MAX_UUID_BATCH).toBeLessThanOrEqual(1000)
  })
})
