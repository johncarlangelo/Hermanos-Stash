/**
 * Pure Base64 codec with correct UTF-8 handling. `btoa`/`atob` operate on
 * binary strings only, so text is routed through TextEncoder/TextDecoder.
 * No React, no DOM beyond standard encoding APIs — fully unit-testable
 * (Node ≥ 12 and every browser provide TextEncoder/TextDecoder globally).
 */

export type CodecResult = { ok: true; output: string } | { ok: false; error: string }

const CHUNK_SIZE = 0x8000 // avoid call-stack overflow on large inputs

/** UTF-8 encode a string into a Base64 payload. */
export function encodeBase64Utf8(input: string): CodecResult {
  try {
    const bytes = new TextEncoder().encode(input)
    let binary = ''
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
    }
    return { ok: true, output: btoa(binary) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Decode a Base64 payload back into a UTF-8 string.
 *
 * Tolerances:
 * - whitespace/newlines anywhere in the payload are ignored;
 * - missing `=` padding is tolerated when the length allows it;
 * - anything else (illegal characters, stray `=`, impossible lengths,
 *   bytes that are not valid UTF-8) is rejected with an actionable error.
 */
export function decodeBase64Utf8(input: string): CodecResult {
  const compact = input.replace(/\s+/g, '')
  if (!compact) return { ok: true, output: '' }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    return { ok: false, error: 'The input contains characters that are not valid Base64.' }
  }
  // A remainder of 1 cannot be repaired by adding padding.
  if (compact.length % 4 === 1) {
    return { ok: false, error: 'The Base64 payload has an impossible length.' }
  }

  const padded = padToMultipleOfFour(compact)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    return { ok: false, error: 'The Base64 payload could not be decoded.' }
  }

  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  try {
    const output = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, output }
  } catch {
    return {
      ok: false,
      error: 'Decoded bytes are not valid UTF-8 — this may not be Base64-encoded text.'
    }
  }
}

function padToMultipleOfFour(s: string): string {
  const remainder = s.length % 4
  if (remainder === 0) return s
  return s + '='.repeat(4 - remainder)
}
