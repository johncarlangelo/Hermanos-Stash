/**
 * File checksum calculation, .sha256sum parsing, and signature verification logic
 */

export type HashAlgorithm = 'SHA-256' | 'SHA-512' | 'SHA-1'

export interface ChecksumFileItem {
  id: string
  name: string
  size: number
  calculatedHash: string
  expectedHash?: string
  status: 'pending' | 'match' | 'mismatch' | 'unverified'
}

/**
 * Compute cryptographic hash of an ArrayBuffer
 */
export async function calculateBufferHash(
  buffer: ArrayBuffer,
  algorithm: HashAlgorithm = 'SHA-256'
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Parse standard .sha256sum / .md5 text files (format: `<hash>  <filename>` or `<hash> *<filename>`)
 */
export function parseChecksumFile(content: string): Record<string, string> {
  const map: Record<string, string> = {}
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Format: hash  filename or hash *filename
    const match = trimmed.match(/^([a-fA-F0-9]{32,128})\s+\*?(.*?)$/)
    if (match) {
      const hash = match[1].toLowerCase()
      const filename = match[2].trim()
      map[filename] = hash
    }
  }

  return map
}

/**
 * Verify calculated hash against expected hash
 */
export function verifyChecksum(
  calculated: string,
  expected?: string
): 'match' | 'mismatch' | 'unverified' {
  if (!expected || !expected.trim()) return 'unverified'
  return calculated.trim().toLowerCase() === expected.trim().toLowerCase() ? 'match' : 'mismatch'
}

/**
 * Generate standard .sha256sum text file content
 */
export function generateChecksumFileContent(
  items: Array<{ name: string; calculatedHash: string }>
): string {
  return items.map((i) => `${i.calculatedHash}  ${i.name}`).join('\n')
}
