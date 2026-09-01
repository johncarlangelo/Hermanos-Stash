/**
 * Semantic Versioning (SemVer 2.0.0) parsing, bump calculation, and range matching logic
 */

export interface SemVerParts {
  raw: string
  major: number
  minor: number
  patch: number
  prerelease?: string
  build?: string
}

export type BumpType =
  'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

const SEMVER_REGEX =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

/**
 * Parse SemVer string into structured parts
 */
export function parseSemVer(version: string): SemVerParts | null {
  const match = version.trim().match(SEMVER_REGEX)
  if (!match) return null

  return {
    raw: version.trim(),
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
    build: match[5] || undefined
  }
}

/**
 * Compare two SemVer strings (-1 if a < b, 0 if a == b, 1 if a > b)
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1)
  const p2 = parseSemVer(v2)

  if (!p1 && !p2) return 0
  if (!p1) return -1
  if (!p2) return 1

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1

  // When major, minor, patch are equal, a prerelease version has lower precedence than normal version
  if (!p1.prerelease && p2.prerelease) return 1
  if (p1.prerelease && !p2.prerelease) return -1
  if (p1.prerelease && p2.prerelease) {
    if (p1.prerelease === p2.prerelease) return 0
    return p1.prerelease.localeCompare(p2.prerelease, undefined, { numeric: true })
  }

  return 0
}

/**
 * Calculate version bump
 */
export function bumpVersion(
  version: string,
  type: BumpType,
  prereleaseTag = 'alpha'
): string | null {
  const parsed = parseSemVer(version)
  if (!parsed) return null

  const { major, minor, patch, prerelease } = parsed

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'premajor':
      return `${major + 1}.0.0-${prereleaseTag}.0`
    case 'preminor':
      return `${major}.${minor + 1}.0-${prereleaseTag}.0`
    case 'prepatch':
      return `${major}.${minor}.${patch + 1}-${prereleaseTag}.0`
    case 'prerelease': {
      if (!prerelease) {
        return `${major}.${minor}.${patch + 1}-${prereleaseTag}.0`
      }
      // Check if ends with number (e.g. alpha.0 -> alpha.1)
      const parts = prerelease.split('.')
      const last = parts[parts.length - 1]
      if (/^\d+$/.test(last)) {
        parts[parts.length - 1] = String(parseInt(last, 10) + 1)
        return `${major}.${minor}.${patch}-${parts.join('.')}`
      }
      return `${major}.${minor}.${patch}-${prerelease}.0`
    }
  }
}

/**
 * Test if a version satisfies a single comparison or range
 */
export function satisfiesRange(version: string, range: string): boolean {
  const parsed = parseSemVer(version)
  if (!parsed) return false

  const cleanRange = range.trim()
  if (!cleanRange || cleanRange === '*' || cleanRange === 'x' || cleanRange === 'X') {
    return true
  }

  // Handle OR clauses (||)
  if (cleanRange.includes('||')) {
    return cleanRange.split('||').some((sub) => satisfiesRange(version, sub))
  }

  // Handle caret range (^1.2.3)
  if (cleanRange.startsWith('^')) {
    const base = parseSemVer(cleanRange.slice(1))
    if (!base) return false
    if (compareSemVer(version, base.raw) < 0) return false
    if (base.major > 0) {
      return parsed.major === base.major
    }
    if (base.minor > 0) {
      return parsed.major === 0 && parsed.minor === base.minor
    }
    return parsed.major === 0 && parsed.minor === 0 && parsed.patch === base.patch
  }

  // Handle tilde range (~1.2.3)
  if (cleanRange.startsWith('~')) {
    const base = parseSemVer(cleanRange.slice(1))
    if (!base) return false
    if (compareSemVer(version, base.raw) < 0) return false
    return parsed.major === base.major && parsed.minor === base.minor
  }

  // Handle inequalities (>=, <=, >, <, =)
  const clauses = cleanRange.split(/\s+/).filter(Boolean)
  for (const clause of clauses) {
    if (clause.startsWith('>=')) {
      const target = clause.slice(2)
      if (compareSemVer(version, target) < 0) return false
    } else if (clause.startsWith('<=')) {
      const target = clause.slice(2)
      if (compareSemVer(version, target) > 0) return false
    } else if (clause.startsWith('>')) {
      const target = clause.slice(1)
      if (compareSemVer(version, target) <= 0) return false
    } else if (clause.startsWith('<')) {
      const target = clause.slice(1)
      if (compareSemVer(version, target) >= 0) return false
    } else if (clause.startsWith('=')) {
      const target = clause.slice(1)
      if (compareSemVer(version, target) !== 0) return false
    } else {
      // Direct equality or x-range (e.g. 1.2.x)
      if (clause.includes('x') || clause.includes('X') || clause.includes('*')) {
        const parts = clause.split('.')
        if (
          parts[0] !== '*' &&
          parts[0].toLowerCase() !== 'x' &&
          parseInt(parts[0], 10) !== parsed.major
        ) {
          return false
        }
        if (
          parts[1] &&
          parts[1] !== '*' &&
          parts[1].toLowerCase() !== 'x' &&
          parseInt(parts[1], 10) !== parsed.minor
        ) {
          return false
        }
      } else {
        if (compareSemVer(version, clause) !== 0) return false
      }
    }
  }

  return true
}
