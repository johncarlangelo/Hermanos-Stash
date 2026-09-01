import { describe, expect, it } from 'vitest'
import {
  calculateBufferHash,
  generateChecksumFileContent,
  parseChecksumFile,
  verifyChecksum
} from './logic'

describe('checksum-verifier logic', () => {
  it('parses standard .sha256sum file content', () => {
    const raw = `
# Comment line
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  empty.txt
5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03 *ubuntu-24.04.iso
`
    const parsed = parseChecksumFile(raw)
    expect(parsed['empty.txt']).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(parsed['ubuntu-24.04.iso']).toBe(
      '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
    )
  })

  it('correctly matches identical hashes case-insensitively', () => {
    expect(verifyChecksum('abc123DEF', 'ABC123def')).toBe('match')
    expect(verifyChecksum('abc123DEF', '111222333')).toBe('mismatch')
    expect(verifyChecksum('abc123DEF', '')).toBe('unverified')
  })

  it('generates standard sha256sum output format', () => {
    const items = [{ name: 'setup.exe', calculatedHash: 'deadbeef1234' }]
    const content = generateChecksumFileContent(items)
    expect(content).toBe('deadbeef1234  setup.exe')
  })

  it('calculates SHA-256 for a test buffer', async () => {
    const buffer = new TextEncoder().encode('Hermanos Stash').buffer
    const hash = await calculateBufferHash(buffer, 'SHA-256')
    expect(hash.length).toBe(64)
  })
})
