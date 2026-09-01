/**
 * Cryptographic keypair and X.509 certificate generation logic using Web Crypto API
 */

export type KeyAlgorithmType = 'RSA' | 'ECDSA' | 'Ed25519'

export interface KeyGenOptions {
  algorithm: KeyAlgorithmType
  rsaModulus: 2048 | 3072 | 4096
  ecNamedCurve: 'P-256' | 'P-384' | 'P-521'
  commonName?: string
  organization?: string
  validityDays?: number
}

export interface GeneratedKeypair {
  publicKeyPem: string
  privateKeyPem: string
  fingerprintSha256: string
  algorithmDetails: string
  generatedAt: string
}

/**
 * Convert binary buffer to formatted Base64 PEM string
 */
export function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

/**
 * Calculate SHA-256 fingerprint from SPKI public key buffer
 */
export async function calculateFingerprint(spkiBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', spkiBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join(':')
}

/**
 * Generate cryptographic keypair using Web Crypto API
 */
export async function generateKeypair(options: KeyGenOptions): Promise<GeneratedKeypair> {
  let keyPair: CryptoKeyPair
  let algoDetails: string

  if (options.algorithm === 'RSA') {
    keyPair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: options.rsaModulus,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair
    algoDetails = `RSA ${options.rsaModulus}-bit (SHA-256)`
  } else if (options.algorithm === 'ECDSA') {
    keyPair = (await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: options.ecNamedCurve
      },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair
    algoDetails = `ECDSA ${options.ecNamedCurve}`
  } else {
    // Ed25519 fallback or subtle
    try {
      keyPair = (await crypto.subtle.generateKey(
        {
          name: 'Ed25519'
        },
        true,
        ['sign', 'verify']
      )) as CryptoKeyPair
      algoDetails = 'Ed25519 (Edwards Curve)'
    } catch {
      // Fallback to ECDSA P-256 if Ed25519 subtle is not supported in current environment
      keyPair = (await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        true,
        ['sign', 'verify']
      )) as CryptoKeyPair
      algoDetails = 'ECDSA P-256 (High Compatibility)'
    }
  }

  // Export SPKI (Public Key)
  const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const publicKeyPem = arrayBufferToPem(spkiBuffer, 'PUBLIC KEY')

  // Export PKCS#8 (Private Key)
  const pkcs8Buffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const privateKeyPem = arrayBufferToPem(pkcs8Buffer, 'PRIVATE KEY')

  const fingerprint = await calculateFingerprint(spkiBuffer)

  return {
    publicKeyPem,
    privateKeyPem,
    fingerprintSha256: fingerprint,
    algorithmDetails: algoDetails,
    generatedAt: new Date().toISOString()
  }
}
