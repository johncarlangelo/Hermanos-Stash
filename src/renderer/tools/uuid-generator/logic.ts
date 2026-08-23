/**
 * UUID v4 generation via the platform CSPRNG (crypto.randomUUID).
 * Pure helpers kept separate for deterministic testing.
 */

export const MAX_UUID_BATCH = 100

export interface UuidFormatOptions {
  uppercase: boolean
  braces: boolean
}

export function formatUuid(uuid: string, options: UuidFormatOptions): string {
  let out = options.uppercase ? uuid.toUpperCase() : uuid
  if (options.braces) out = `{${out}}`
  return out
}

export function isValidUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
