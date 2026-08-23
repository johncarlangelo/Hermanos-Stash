import type { DatabaseSync } from 'node:sqlite'
import type { HistoryEntry, HistoryEntryInput } from '../../shared/ipc'
import { stashError } from '../../shared/errors'

/**
 * Row-level stores over the SQLite database. These modules are Electron-free
 * so they can be unit tested directly against an in-memory database.
 */

function readJsonArray(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(value))
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[]
    }
  } catch {
    // fall through
  }
  return []
}

// ---------------------------------------------------------------------------
// Preferences (opaque JSON values keyed by string)
// ---------------------------------------------------------------------------

export class PrefsStore {
  constructor(private db: DatabaseSync) {}

  get<T = unknown>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM prefs WHERE key = ?').get(key)
    if (!row) return undefined
    try {
      return JSON.parse(String((row as Record<string, unknown>)['value'])) as T
    } catch {
      return undefined
    }
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, JSON.stringify(value))
  }
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export class FavoritesStore {
  constructor(private db: DatabaseSync) {}

  list(): string[] {
    const rows = this.db.prepare('SELECT tool_id FROM favorites ORDER BY added_at_ms').all()
    return rows.map((r) => String((r as Record<string, unknown>)['tool_id']))
  }

  /** Returns the new favorite state for the tool. */
  toggle(toolId: string, now: number = Date.now()): boolean {
    const exists = this.db.prepare('SELECT 1 FROM favorites WHERE tool_id = ?').get(toolId)
    if (exists) {
      this.db.prepare('DELETE FROM favorites WHERE tool_id = ?').run(toolId)
      return false
    }
    this.db.prepare('INSERT INTO favorites (tool_id, added_at_ms) VALUES (?, ?)').run(toolId, now)
    return true
  }
}

// ---------------------------------------------------------------------------
// Recent tools
// ---------------------------------------------------------------------------

export interface RecentToolRow {
  toolId: string
  lastUsedMs: number
  uses: number
}

export class RecentsStore {
  constructor(private db: DatabaseSync) {}

  list(limit = 12): RecentToolRow[] {
    const rows = this.db
      .prepare('SELECT tool_id, last_used_ms, uses FROM recents ORDER BY last_used_ms DESC LIMIT ?')
      .all(limit)
    return rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        toolId: String(row['tool_id']),
        lastUsedMs: Number(row['last_used_ms']),
        uses: Number(row['uses'])
      }
    })
  }

  add(toolId: string, now: number = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO recents (tool_id, last_used_ms, uses) VALUES (?, ?, 1)
         ON CONFLICT(tool_id) DO UPDATE SET last_used_ms = excluded.last_used_ms, uses = uses + 1`
      )
      .run(toolId, now)
  }
}

// ---------------------------------------------------------------------------
// Activity history
// ---------------------------------------------------------------------------

const HISTORY_COLUMNS =
  'id, timestamp_ms AS timestampMs, tool_id AS toolId, operation, inputs_json, outputs_json, status, duration_ms AS durationMs, message'

function rowToHistoryEntry(row: Record<string, unknown>): HistoryEntry {
  return {
    id: Number(row['id']),
    timestampMs: Number(row['timestampMs']),
    toolId: String(row['toolId']),
    operation: String(row['operation']),
    inputs: readJsonArray(row['inputs_json']),
    outputs: readJsonArray(row['outputs_json']),
    status: row['status'] === 'failure' ? 'failure' : 'success',
    durationMs:
      row['durationMs'] === null || row['durationMs'] === undefined
        ? undefined
        : Number(row['durationMs']),
    message:
      row['message'] === null || row['message'] === undefined ? undefined : String(row['message'])
  }
}

export function assertHistoryEntry(entry: HistoryEntryInput): void {
  const fail = (detail: string): never => {
    throw stashError('VALIDATION', 'The activity record is malformed.', {
      technicalMessage: detail
    })
  }
  if (typeof entry.toolId !== 'string' || !entry.toolId.trim()) fail('toolId')
  if (typeof entry.operation !== 'string' || !entry.operation.trim()) fail('operation')
  if (entry.status !== 'success' && entry.status !== 'failure') fail('status')
  for (const field of ['inputs', 'outputs'] as const) {
    const list = entry[field]
    if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) fail(field)
  }
}

export class HistoryStore {
  private insertStmt

  constructor(private db: DatabaseSync) {
    this.insertStmt = db.prepare(
      `INSERT INTO activity (timestamp_ms, tool_id, operation, inputs_json, outputs_json, status, duration_ms, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
  }

  record(entry: HistoryEntryInput, now: number = Date.now()): HistoryEntry {
    assertHistoryEntry(entry)
    const result = this.insertStmt.run(
      now,
      entry.toolId,
      entry.operation,
      JSON.stringify(entry.inputs),
      JSON.stringify(entry.outputs),
      entry.status,
      entry.durationMs ?? null,
      entry.message ?? null
    )
    const id = Number(result.lastInsertRowid)
    const row = this.db
      .prepare(`SELECT ${HISTORY_COLUMNS} FROM activity WHERE id = ?`)
      .get(id) as Record<string, unknown>
    return rowToHistoryEntry(row)
  }

  list(limit = 100): HistoryEntry[] {
    const rows = this.db
      .prepare(`SELECT ${HISTORY_COLUMNS} FROM activity ORDER BY timestamp_ms DESC LIMIT ?`)
      .all(limit) as Array<Record<string, unknown>>
    return rows.map(rowToHistoryEntry)
  }

  clear(): void {
    this.db.exec('DELETE FROM activity')
  }
}
