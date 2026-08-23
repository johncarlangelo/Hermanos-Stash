/**
 * Pure presentation helpers for the hash tool. Digest computation itself runs
 * in the main process via node:crypto (see shared/ipc.ts → crypto channels).
 */

import type { HashAlgorithm } from '../../../shared/ipc'

export type { HashAlgorithm }

export const HASH_ALGORITHMS: Array<{ id: HashAlgorithm; label: string }> = [
  { id: 'md5', label: 'MD5' },
  { id: 'sha1', label: 'SHA-1' },
  { id: 'sha256', label: 'SHA-256' },
  { id: 'sha512', label: 'SHA-512' }
]

/** Expected hex digest length per algorithm, used as a sanity check. */
export const HEX_LENGTH_BY_ALGORITHM: Record<HashAlgorithm, number> = {
  md5: 32,
  sha1: 40,
  sha256: 64,
  sha512: 128
}

/**
 * Format a lowercase hex digest for display — optionally uppercase and
 * grouped in pairs of 8 for easier visual comparison.
 */
export function formatDigest(hex: string, options?: { upper?: boolean }): string {
  const upper = hex.toUpperCase()
  return options?.upper ? upper : hex.toLowerCase()
}

/** True when `hex` looks like a plausible digest for the given algorithm. */
export function isPlausibleDigest(hex: string, algorithm: HashAlgorithm): boolean {
  return new RegExp(`^[0-9a-fA-F]{${HEX_LENGTH_BY_ALGORITHM[algorithm]}}$`).test(hex)
}
