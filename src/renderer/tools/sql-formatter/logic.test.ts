import { describe, expect, it } from 'vitest'
import { formatSql } from './logic'

describe('formatSql', () => {
  it('formats a select with joins', () => {
    const result = formatSql('select u.id, o.total from users u join orders o on u.id=o.user_id', {
      keywordCase: 'upper'
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toContain('SELECT')
      expect(result.output).toContain('FROM')
      expect(result.output).toContain('JOIN')
      expect(result.output.split('\n').length).toBeGreaterThan(1)
    }
  })

  it('uppercases keywords when asked', () => {
    const result = formatSql('select a from t where b = 1', { keywordCase: 'upper' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toContain('SELECT')
      expect(result.output).not.toContain('select')
    }
  })

  it('lowercases keywords when asked', () => {
    const result = formatSql('SELECT a FROM t', { keywordCase: 'lower' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('select')
  })

  it('respects dialect selection', () => {
    // MySQL allows backtick quoting; standard SQL does not.
    const result = formatSql('SELECT `col` FROM `tbl`', { language: 'mysql' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('`col`')
  })

  it('returns an error shape for unparseable input', () => {
    const result = formatSql('select ((((')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.error.message).toBe('string')
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('maps empty input to empty output without error', () => {
    expect(formatSql('')).toEqual({ ok: true, output: '' })
    expect(formatSql('   \n\t ')).toEqual({ ok: true, output: '' })
  })

  it('honors indentation width', () => {
    const twoSpace = formatSql('select a from t')
    const fourSpace = formatSql('select a from t', { indent: '    ' })
    expect(twoSpace.ok && fourSpace.ok).toBe(true)
    if (twoSpace.ok && fourSpace.ok) {
      expect(fourSpace.output).toContain('    a')
      expect(twoSpace.output).toContain('  a')
    }
  })
})
