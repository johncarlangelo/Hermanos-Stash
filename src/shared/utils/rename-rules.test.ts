import { describe, expect, it } from 'vitest'
import { applyRenameRules, buildRenamePlan } from './rename-rules'

const entries = (names: string[]) => names.map((name) => ({ name, isDirectory: false }))

describe('applyRenameRules — each rule alone', () => {
  it('literal find/replace', () => {
    expect(applyRenameRules('holiday-photo-1', 0, { find: 'photo', replace: 'pic' })).toBe(
      'holiday-pic-1'
    )
    expect(applyRenameRules('report.txt', 0, { find: '-x-', replace: '' })).toBe('report.txt')
  })

  it('regex find/replace with capture groups', () => {
    expect(
      applyRenameRules('2024-01-report', 0, {
        find: '(\\d{4})-(\\d{2})',
        replace: '$2-$1',
        useRegex: true
      })
    ).toBe('01-2024-report')
  })

  it('prefix and suffix concatenate around the base only', () => {
    expect(applyRenameRules('notes.md', 0, { prefix: 'old-', suffix: '-bak' })).toBe(
      'old-notes-bak.md'
    )
  })

  it('numbering pads to three digits before or after the base', () => {
    expect(applyRenameRules('a.png', 0, { numbering: 'prefix-sep' })).toBe('001-a.png')
    expect(applyRenameRules('b.png', 41, { numbering: 'prefix-sep', sep: '_' })).toBe('042_b.png')
    expect(applyRenameRules('c.png', 2, { numbering: 'suffix-sep', sep: ' ' })).toBe('c 003.png')
  })

  it('case modes transform the base but leave the extension untouched', () => {
    expect(applyRenameRules('Mixed Case.TXT', 0, { caseMode: 'lower' })).toBe('mixed case.TXT')
    expect(applyRenameRules('quiet file.mp3', 0, { caseMode: 'upper' })).toBe('QUIET FILE.mp3')
    expect(applyRenameRules('my cool TRACK.flac', 0, { caseMode: 'title' })).toBe(
      'My Cool Track.flac'
    )
  })

  it('extension change replaces only when the from filter matches', () => {
    const rules = { changeExt: { to: 'webp' } }
    expect(applyRenameRules('photo.jpeg', 0, rules)).toBe('photo.webp')
    // Dot-less base names still get an extension.
    expect(applyRenameRules('README', 0, rules)).toBe('README.webp')
    expect(applyRenameRules('no-ext', 0, { changeExt: { to: '.png', from: '.jpg' } })).toBe(
      'no-ext'
    )
    expect(applyRenameRules('shot.JPG', 0, { changeExt: { to: 'png', from: 'jpg' } })).toBe(
      'shot.png'
    )
    expect(applyRenameRules('shot.jpg', 0, { changeExt: { to: 'png', from: '.jpeg' } })).toBe(
      'shot.jpg'
    )
  })
})

describe('applyRenameRules — combination ordering', () => {
  it('applies replace → case → prefix/suffix → numbering → extension', () => {
    expect(
      applyRenameRules('Draft Report v1.docx', 4, {
        find: ' ',
        replace: '_',
        caseMode: 'upper',
        prefix: 'ARCHIVE-',
        suffix: '-FINAL',
        numbering: 'suffix-sep',
        sep: '~',
        changeExt: { to: '.pdf' }
      })
    ).toBe('ARCHIVE-DRAFT_REPORT_V1-FINAL~005.pdf')
  })

  it('numbering indexes by position in the batch, not the entry index', () => {
    // buildRenamePlan skips identity mappings, so applyRenameRules receives
    // compact indices — verify token follows the given index.
    expect(applyRenameRules('z.txt', 9, {})).toBe('z.txt')
    expect(applyRenameRules('z.txt', 9, { numbering: 'prefix-sep' })).toBe('010-z.txt')
  })
})

describe('buildRenamePlan', () => {
  it('excludes identity mappings and returns an empty plan when nothing changes', () => {
    const result = buildRenamePlan(entries(['same.txt', 'other.png']), {})
    expect(result).toEqual({ plan: [], conflicts: [] })
  })

  it('excludes directories by default and includes them when asked', () => {
    const mixed = [
      { name: 'sub', isDirectory: true },
      { name: 'file.txt', isDirectory: false }
    ]
    const excluded = buildRenamePlan(mixed, { suffix: '-x' })
    expect(excluded.plan).toEqual([{ from: 'file.txt', to: 'file-x.txt' }])
    const included = buildRenamePlan(mixed, { suffix: '-x' }, { includeDirectories: true })
    expect(included.plan.map((p) => p.from)).toEqual(['sub', 'file.txt'])
  })

  it('detects duplicate targets case-insensitively and lists conflicting names', () => {
    const result = buildRenamePlan(entries(['a-1.txt', 'a-2.txt', 'keep.txt']), {
      find: '-\\d',
      replace: '',
      useRegex: true
    })
    expect(result.plan.map((p) => p.to)).toEqual(['a.txt', 'a.txt'])
    expect(result.conflicts).toEqual(['a-1.txt', 'a-2.txt'])
    expect(result.error).toBeUndefined()
  })

  it('surfaces an invalid regex as an error variant instead of throwing', () => {
    const result = buildRenamePlan(entries(['one.txt']), { find: '([bad', useRegex: true })
    expect(result.plan).toEqual([])
    expect(typeof result.error).toBe('string')
    expect(result.error!.length).toBeGreaterThan(0)
  })

  it('does not flag collisions against files left untouched', () => {
    // "b.txt" already exists untouched; renaming "B.TXT" → "b.txt" collides
    // on disk even though the untouched file is not part of the plan. The
    // plan-level check covers planned targets; this case must stay conflict-
    // free at plan level because only one planned row exists.
    const result = buildRenamePlan(entries(['B.TXT', 'b.txt']), { caseMode: 'lower' })
    expect(result.plan.length).toBe(1)
    expect(result.conflicts).toEqual([])
  })

  it('numbering applies to every entry in listing order, not only matched ones', () => {
    const result = buildRenamePlan(entries(['a-one.txt', 'untouched.txt', 'a-two.txt']), {
      numbering: 'suffix-sep'
    })
    expect(result.plan).toEqual([
      { from: 'a-one.txt', to: 'a-one-001.txt' },
      { from: 'untouched.txt', to: 'untouched-002.txt' },
      { from: 'a-two.txt', to: 'a-two-003.txt' }
    ])
  })
})
