import { describe, expect, it } from 'vitest'
import { arrayBufferToPem, generateKeypair } from './logic'

describe('keypair-generator logic', () => {
  it('formats arrayBuffer into formatted Base64 PEM', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    const pem = arrayBufferToPem(data, 'TEST KEY')
    expect(pem.startsWith('-----BEGIN TEST KEY-----')).toBe(true)
    expect(pem.endsWith('-----END TEST KEY-----')).toBe(true)
  })

  it('generates ECDSA P-256 keypair with valid PEM headers and fingerprint', async () => {
    const keypair = await generateKeypair({
      algorithm: 'ECDSA',
      rsaModulus: 2048,
      ecNamedCurve: 'P-256'
    })

    expect(keypair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(keypair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----')
    expect(keypair.fingerprintSha256).toMatch(/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/)
    expect(keypair.algorithmDetails).toContain('ECDSA')
  })

  it('generates RSA 2048 keypair', async () => {
    const keypair = await generateKeypair({
      algorithm: 'RSA',
      rsaModulus: 2048,
      ecNamedCurve: 'P-256'
    })

    expect(keypair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(keypair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----')
    expect(keypair.algorithmDetails).toContain('RSA 2048')
  })
})
