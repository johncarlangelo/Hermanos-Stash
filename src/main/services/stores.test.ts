import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase, CURRENT_SCHEMA_VERSION } from './db'
import { FavoritesStore, HistoryStore, PrefsStore, PromptsStore, RecentsStore } from './stores'

function freshStores() {
  const { db } = openDatabase(':memory:')
  return {
    db,
    prefs: new PrefsStore(db),
    favorites: new FavoritesStore(db),
    recents: new RecentsStore(db),
    history: new HistoryStore(db),
    prompts: new PromptsStore(db)
  }
}

describe('openDatabase migrations', () => {
  it('creates schema and stamps user_version', () => {
    const { db } = openDatabase(':memory:')
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<
        Record<string, unknown>
      >
    ).map((r) => String(r['name']))
    expect(tables).toEqual(expect.arrayContaining(['prefs', 'favorites', 'recents', 'activity']))
    const version = Object.values(
      db.prepare('PRAGMA user_version').get() as Record<string, unknown>
    )[0]
    expect(Number(version)).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('PrefsStore', () => {
  it('round-trips JSON values and returns undefined for missing keys', () => {
    const s = freshStores()
    expect(s.prefs.get('missing')).toBeUndefined()
    s.prefs.set('ui.density', 'comfortable')
    s.prefs.set('nested', { a: [1, 2] })
    expect(s.prefs.get('ui.density')).toBe('comfortable')
    expect(s.prefs.get<{ a: number[] }>('nested')?.a).toEqual([1, 2])
    s.prefs.set('ui.density', 'compact')
    expect(s.prefs.get('ui.density')).toBe('compact')
  })
})

describe('FavoritesStore', () => {
  it('toggles favorite state and preserves order by add time', () => {
    const s = freshStores()
    expect(s.favorites.list()).toEqual([])
    expect(s.favorites.toggle('b-tool', 1000)).toBe(true)
    expect(s.favorites.toggle('a-tool', 2000)).toBe(true)
    expect(s.favorites.list()).toEqual(['b-tool', 'a-tool'])
    expect(s.favorites.toggle('b-tool')).toBe(false)
    expect(s.favorites.list()).toEqual(['a-tool'])
  })
})

describe('RecentsStore', () => {
  it('tracks usage counts and orders by recency with limits', () => {
    const s = freshStores()
    s.recents.add('old', 1000)
    s.recents.add('new', 2000)
    expect(s.recents.list().map((r) => r.toolId)).toEqual(['new', 'old'])
    expect(s.recents.list(1).map((r) => r.toolId)).toEqual(['new'])
    s.recents.add('old', 3000)
    const oldRow = s.recents.list().find((r) => r.toolId === 'old')
    expect(oldRow?.uses).toBe(2)
  })
})

describe('HistoryStore', () => {
  it('records and lists activity newest-first', () => {
    const s = freshStores()
    const entry = s.history.record(
      {
        toolId: 'json-format',
        operation: 'format',
        inputs: ['config.json'],
        outputs: [],
        status: 'success',
        durationMs: 12
      },
      1000
    )
    expect(entry.id).toBeGreaterThan(0)
    expect(entry.timestampMs).toBe(1000)

    s.history.record(
      {
        toolId: 'pdf-merge',
        operation: 'merge',
        inputs: ['a.pdf', 'b.pdf'],
        outputs: ['merged.pdf'],
        status: 'failure',
        message: 'encrypted input'
      },
      2000
    )

    const rows = s.history.list()
    expect(rows.map((r) => r.toolId)).toEqual(['pdf-merge', 'json-format'])
    const failure = rows[0]!
    expect(failure.status).toBe('failure')
    expect(failure.inputs).toEqual(['a.pdf', 'b.pdf'])
    expect(failure.outputs).toEqual(['merged.pdf'])
    expect(failure.message).toBe('encrypted input')
  })

  it('rejects malformed records', () => {
    const s = freshStores()
    expect(() =>
      s.history.record({ toolId: '', operation: 'x', inputs: [], outputs: [], status: 'success' })
    ).toThrow()
    expect(() =>
      s.history.record({
        toolId: 't',
        operation: 'x',
        inputs: [42 as unknown as string],
        outputs: [],
        status: 'success'
      })
    ).toThrow()

    expect(s.history.list().length).toBe(0)
  })

  it('clears all history', () => {
    const s = freshStores()
    s.history.record({ toolId: 't', operation: 'op', inputs: [], outputs: [], status: 'success' })
    s.history.clear()
    expect(s.history.list()).toEqual([])
  })

  it('uses WAL journal mode on file-backed databases', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stash-db-'))
    try {
      const { db } = openDatabase(dir)
      const mode = Object.values(
        db.prepare('PRAGMA journal_mode').get() as Record<string, unknown>
      )[0]
      expect(String(mode)).toBe('wal')
      db.close()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('exposes the underlying DatabaseSync for direct use', () => {
    const s = freshStores()
    expect(s.db).toBeInstanceOf(DatabaseSync)
  })
})

describe('PromptsStore', () => {
  it('creates, lists newest-first, updates and deletes prompts', () => {
    const s = freshStores()
    expect(s.prompts.count()).toBe(0)

    const created = s.prompts.save(
      { title: 'Code Review', body: 'Review {{lang}} code.', tags: ['Code', 'review'] },
      1000
    )
    expect(created.id).toBeGreaterThan(0)
    expect(created.tags).toEqual(['code', 'review'])

    s.prompts.save({ title: 'Blog Outline', body: 'Outline {{topic}}', tags: [] }, 2000)
    let rows = s.prompts.list()
    expect(rows.map((r) => r.title)).toEqual(['Blog Outline', 'Code Review'])

    const updated = s.prompts.save(
      { id: created.id, title: 'Deep Code Review', body: 'updated', tags: ['deep'] },
      3000
    )
    expect(updated.id).toBe(created.id)
    rows = s.prompts.list()
    expect(rows[0]!.title).toBe('Deep Code Review')
    expect(rows[0]!.updatedAtMs).toBe(3000)
    expect(rows[0]!.createdAtMs).toBe(1000)

    s.prompts.delete(created.id)
    rows = s.prompts.list()
    expect(rows.map((r) => r.title)).toEqual(['Blog Outline'])
    // Updating a deleted prompt fails cleanly.
    expect(() => s.prompts.save({ id: created.id, title: 'x', body: 'y', tags: [] })).toThrow()
  })

  it('rejects malformed prompt input', () => {
    const s = freshStores()
    expect(() => s.prompts.save({ title: '  ', body: 'b', tags: [] })).toThrow()
    expect(() => s.prompts.save({ title: 't', body: '', tags: [] })).toThrow()
    expect(() =>
      s.prompts.save({ title: 't', body: 'b', tags: [42 as unknown as string] })
    ).toThrow()
    expect(() => s.prompts.save({ title: 't'.repeat(121), body: 'b', tags: [] })).toThrow()
    expect(s.prompts.count()).toBe(0)
  })
})
