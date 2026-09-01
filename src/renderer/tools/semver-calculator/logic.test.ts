import { describe, expect, it } from 'vitest'
import { bumpVersion, compareSemVer, parseSemVer, satisfiesRange } from './logic'

describe('semver-calculator logic', () => {
  it('parses semver string into components', () => {
    const parsed = parseSemVer('1.2.3-beta.1+20260901')
    expect(parsed).not.toBeNull()
    expect(parsed?.major).toBe(1)
    expect(parsed?.minor).toBe(2)
    expect(parsed?.patch).toBe(3)
    expect(parsed?.prerelease).toBe('beta.1')
    expect(parsed?.build).toBe('20260901')
  })

  it('correctly calculates version bumps', () => {
    const v = '1.2.3'
    expect(bumpVersion(v, 'major')).toBe('2.0.0')
    expect(bumpVersion(v, 'minor')).toBe('1.3.0')
    expect(bumpVersion(v, 'patch')).toBe('1.2.4')
    expect(bumpVersion(v, 'premajor', 'beta')).toBe('2.0.0-beta.0')
    expect(bumpVersion('1.2.3-alpha.0', 'prerelease')).toBe('1.2.3-alpha.1')
  })

  it('compares versions according to SemVer 2.0 precedence', () => {
    expect(compareSemVer('1.0.0', '2.0.0')).toBe(-1)
    expect(compareSemVer('1.2.0', '1.1.9')).toBe(1)
    expect(compareSemVer('1.0.0-alpha', '1.0.0')).toBe(-1)
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0)
  })

  it('evaluates caret and tilde ranges', () => {
    expect(satisfiesRange('1.2.5', '^1.2.0')).toBe(true)
    expect(satisfiesRange('2.0.0', '^1.2.0')).toBe(false)
    expect(satisfiesRange('1.2.5', '~1.2.0')).toBe(true)
    expect(satisfiesRange('1.3.0', '~1.2.0')).toBe(false)
  })

  it('evaluates complex inequality and OR ranges', () => {
    expect(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0')).toBe(true)
    expect(satisfiesRange('2.5.0', '>=1.0.0 <2.0.0')).toBe(false)
    expect(satisfiesRange('3.1.0', '^1.0.0 || >=3.0.0')).toBe(true)
  })
})
