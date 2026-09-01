import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHMOD_STATE,
  getBinaryString,
  getOctalString,
  getSymbolicString,
  parseOctal
} from './logic'

describe('chmod-calculator logic', () => {
  it('calculates 755 for default state', () => {
    expect(getOctalString(DEFAULT_CHMOD_STATE)).toBe('755')
    expect(getSymbolicString(DEFAULT_CHMOD_STATE)).toBe('-rwxr-xr-x')
    expect(getBinaryString(DEFAULT_CHMOD_STATE)).toBe('111 101 101')
  })

  it('parses 644 octal string correctly', () => {
    const state = parseOctal('644')
    expect(state).not.toBeNull()
    expect(state?.ownerRead).toBe(true)
    expect(state?.ownerWrite).toBe(true)
    expect(state?.ownerExecute).toBe(false)
    expect(state?.groupRead).toBe(true)
    expect(state?.othersRead).toBe(true)
    expect(getSymbolicString(state!)).toBe('-rw-r--r--')
  })

  it('handles 4-digit special bit octals like 4755', () => {
    const state = parseOctal('4755')
    expect(state?.suid).toBe(true)
    expect(getOctalString(state!, true)).toBe('4755')
    expect(getSymbolicString(state!)).toBe('-rwsr-xr-x')
  })

  it('handles directory symbolic notation', () => {
    expect(getSymbolicString(DEFAULT_CHMOD_STATE, true)).toBe('drwxr-xr-x')
  })
})
