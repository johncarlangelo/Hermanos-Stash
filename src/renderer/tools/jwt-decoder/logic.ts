/**
 * Pure JWT decoding (no verification). Splits, base64url-decodes and
 * JSON-parses each segment; every failure becomes a typed `{ error }`.
 */

export interface JwtHeader {
  [key: string]: unknown
}

export interface JwtPayload {
  /** Expiry in seconds since epoch, when present. */
  exp?: number
  iat?: number
  nbf?: number
  [key: string]: unknown
}

export interface DecodedJwt {
  header: JwtHeader
  payload: JwtPayload
  /** Raw signature segment — never verified here. */
  signature: string
}

export type DecodeJwtResult = DecodedJwt | { error: { message: string } }

export function decodeJwt(token: string): DecodeJwtResult {
  const trimmed = token.trim()
  if (!trimmed) return { error: { message: 'Paste a token to decode.' } }

  const segments = trimmed.split('.')
  if (segments.length < 2 || segments.length > 3) {
    return {
      error: {
        message: 'A JWT has two or three dot-separated segments — header.payload.signature.'
      }
    }
  }

  const header = parseSegment(segments[0]!, 'header')
  if ('error' in header) return header
  if (!isPlainObject(header.value)) {
    return { error: { message: 'The token header is not a JSON object.' } }
  }

  const payload = parseSegment(segments[1]!, 'payload')
  if ('error' in payload) return payload
  if (!isPlainObject(payload.value)) {
    return { error: { message: 'The token payload is not a JSON object.' } }
  }

  return {
    header: header.value,
    payload: payload.value,
    signature: segments[2] ?? ''
  }
}

function parseSegment(
  segment: string,
  label: string
): { value: unknown } | { error: { message: string } } {
  if (!segment) {
    return { error: { message: `The ${label} segment is empty.` } }
  }
  const bytes = base64UrlToBytes(segment)
  if (bytes === null) {
    return {
      error: { message: `The ${label} segment is not valid Base64URL.` }
    }
  }
  let json: string
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { error: { message: `The ${label} segment is not valid UTF-8 text.` } }
  }
  try {
    return { value: JSON.parse(json) as unknown }
  } catch {
    return { error: { message: `The ${label} segment is not valid JSON.` } }
  }
}

/** Base64url → raw bytes. Returns null on any illegal character or length. */
function base64UrlToBytes(input: string): Uint8Array | null {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  // A remainder of 1 cannot be repaired by padding.
  if (b64.length % 4 === 1) return null
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * True when `payload.exp` is present and at-or-before `nowMs`
 * (`exp` equals now counts as expired).
 */
export function isExpired(payload: JwtPayload, nowMs: number): boolean {
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return false
  return payload.exp * 1000 <= nowMs
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
