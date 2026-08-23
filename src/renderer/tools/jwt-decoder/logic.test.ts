import { describe, expect, it } from 'vitest'
import { decodeJwt, isExpired } from './logic'

const b64url = (value: string): string => Buffer.from(value).toString('base64url')

function makeToken(payload: object): string {
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify(payload))}.sig`
}

/** Narrow to the error branch or fail loudly. */
function errorOf(result: ReturnType<typeof decodeJwt>): { message: string } {
  if (!('error' in result)) throw new Error('expected a decode error')
  return result.error
}

describe('decodeJwt — valid tokens', () => {
  it('decodes header, payload and keeps the raw signature', () => {
    const r = decodeJwt(
      `${b64url('{"alg":"none"}')}.${b64url('{"sub":"u1"}')}.${b64url('signature-bytes')}`
    )
    if ('error' in r) throw new Error(`unexpected error: ${JSON.stringify(r.error)}`)
    expect(r.header).toEqual({ alg: 'none' })
    expect(r.payload).toEqual({ sub: 'u1' })
    // Signature is preserved verbatim (base64url of the input segment).
    expect(r.signature.length).toBeGreaterThan(0)
  })

  it('accepts two-segment unsigned tokens with an empty signature', () => {
    const r = decodeJwt(`${b64url('{"alg":"none"}')}.${b64url('{"sub":"u2"}')}`)
    if ('error' in r) throw new Error('expected success')
    expect(r.signature).toBe('')
  })

  it('preserves nested payload structures', () => {
    const r = decodeJwt(makeToken({ sub: 'x', scope: { admin: true } }))
    if ('error' in r) throw new Error('expected success')
    expect(r.payload.scope).toEqual({ admin: true })
  })

  it('tolerates whitespace around the token', () => {
    const r = decodeJwt(`   ${makeToken({ sub: 'ws' })}  `)
    expect('error' in r).toBe(false)
  })
})

describe('decodeJwt — malformed tokens', () => {
  it('rejects empty input', () => {
    expect(errorOf(decodeJwt('   ')).message).toBeTruthy()
  })

  it('rejects one segment', () => {
    expect(errorOf(decodeJwt('onlyheader')).message).toContain('two or three')
  })

  it('rejects four segments', () => {
    expect(errorOf(decodeJwt('a.b.c.d')).message).toContain('two or three')
  })

  it('rejects a bad-base64 header', () => {
    expect(errorOf(decodeJwt(`%%%.${b64url('{"sub":"x"}')}.sig`)).message).toContain('Base64URL')
  })

  it('rejects non-JSON payload bytes', () => {
    const notJson = Buffer.from([0xff]).toString('base64url')
    expect(errorOf(decodeJwt(`${b64url('{}')}.${notJson}.sig`)).message).toBeTruthy()
  })

  it('rejects valid JSON that is not an object', () => {
    const arrayPayload = b64url('[1,2]')
    expect(errorOf(decodeJwt(`${b64url('{}')}.${arrayPayload}`)).message).toContain(
      'payload is not a JSON object'
    )
  })
})

describe('isExpired', () => {
  const nowMs = Date.UTC(2026, 7, 23, 12, 0, 0)

  it('treats exp exactly equal to now as expired', () => {
    expect(isExpired({ exp: nowMs / 1000 }, nowMs)).toBe(true)
  })

  it('treats exp one second in the future as valid', () => {
    expect(isExpired({ exp: nowMs / 1000 + 1 }, nowMs)).toBe(false)
  })

  it('treats past expiry as expired', () => {
    expect(isExpired({ exp: nowMs / 1000 - 3600 }, nowMs)).toBe(true)
  })

  it('returns false when no exp claim exists', () => {
    expect(isExpired({}, nowMs)).toBe(false)
    expect(isExpired({ iat: 123 }, nowMs)).toBe(false)
  })

  it('ignores non-numeric exp values', () => {
    expect(isExpired({ exp: 'soon' as unknown as number }, nowMs)).toBe(false)
  })
})
