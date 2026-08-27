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

const HISTORY_MAX_PATHS = 100
const HISTORY_MAX_ITEM_LENGTH = 500
const HISTORY_MAX_MESSAGE_LENGTH = 1000

function clampPathList(list: string[]): string[] {
  return list.slice(0, HISTORY_MAX_PATHS).map((item) => item.slice(0, HISTORY_MAX_ITEM_LENGTH))
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
  if (
    entry.durationMs !== undefined &&
    (!Number.isFinite(entry.durationMs) || (entry.durationMs as number) < 0)
  ) {
    fail('durationMs')
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
      String(entry.operation).slice(0, HISTORY_MAX_ITEM_LENGTH),
      JSON.stringify(clampPathList(entry.inputs)),
      JSON.stringify(clampPathList(entry.outputs)),
      entry.status,
      entry.durationMs ?? null,
      entry.message ? String(entry.message).slice(0, HISTORY_MAX_MESSAGE_LENGTH) : null
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

// ---------------------------------------------------------------------------
// Prompt library
// ---------------------------------------------------------------------------

export interface PromptRecord {
  id: number
  title: string
  body: string
  tags: string[]
  createdAtMs: number
  updatedAtMs: number
}

export interface PromptSaveInput {
  id?: number
  title: string
  body: string
  tags: string[]
}

const PROMPT_LIMITS = { title: 120, body: 32_000, tags: 12, tagLength: 24 }

export function assertPromptInput(input: PromptSaveInput): void {
  const fail = (detail: string): never => {
    throw stashError('VALIDATION', 'The prompt is malformed.', { technicalMessage: detail })
  }
  if (typeof input.title !== 'string' || !input.title.trim()) fail('title')
  if (input.title.length > PROMPT_LIMITS.title) fail('title too long')
  if (typeof input.body !== 'string' || !input.body.trim()) fail('body')
  if (input.body.length > PROMPT_LIMITS.body) fail('body too long')
  if (!Array.isArray(input.tags) || !input.tags.every((t) => typeof t === 'string')) fail('tags')
  if ((input.tags as string[]).length > PROMPT_LIMITS.tags) fail('too many tags')
  for (const tag of input.tags) {
    if (!tag.trim() || tag.length > PROMPT_LIMITS.tagLength) fail('tag length')
  }
  if (input.id !== undefined && !Number.isInteger(input.id)) fail('id')
}

const clampTags = (tags: string[]): string[] =>
  tags
    .map((t) => t.trim().toLowerCase().slice(0, PROMPT_LIMITS.tagLength))
    .filter(Boolean)
    .slice(0, PROMPT_LIMITS.tags)

export class PromptsStore {
  constructor(private db: DatabaseSync) {}

  list(): PromptRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, body, tags_json, created_ms AS createdAtMs, updated_ms AS updatedAtMs
         FROM prompts ORDER BY updated_ms DESC`
      )
      .all() as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: Number(row['id']),
      title: String(row['title']),
      body: String(row['body']),
      tags: readJsonArray(row['tags_json']),
      createdAtMs: Number(row['createdAtMs']),
      updatedAtMs: Number(row['updatedAtMs'])
    }))
  }

  save(input: PromptSaveInput, now: number = Date.now()): PromptRecord {
    assertPromptInput(input)
    const tagsJson = JSON.stringify(clampTags(input.tags))
    let id = input.id
    if (id === undefined) {
      const result = this.db
        .prepare(
          'INSERT INTO prompts (title, body, tags_json, created_ms, updated_ms) VALUES (?, ?, ?, ?, ?)'
        )
        .run(input.title.trim(), input.body, tagsJson, now, now)
      id = Number(result.lastInsertRowid)
    } else {
      const result = this.db
        .prepare(
          'UPDATE prompts SET title = ?, body = ?, tags_json = ?, updated_ms = ? WHERE id = ?'
        )
        .run(input.title.trim(), input.body, tagsJson, now, id)
      if (Number(result.changes) === 0) {
        throw stashError('VALIDATION', 'That prompt no longer exists.', {
          technicalMessage: `id ${id} not found`
        })
      }
    }
    const row = this.db
      .prepare(
        `SELECT id, title, body, tags_json, created_ms AS createdAtMs, updated_ms AS updatedAtMs
         FROM prompts WHERE id = ?`
      )
      .get(id) as Record<string, unknown>
    return {
      id: Number(row['id']),
      title: String(row['title']),
      body: String(row['body']),
      tags: readJsonArray(row['tags_json']),
      createdAtMs: Number(row['createdAtMs']),
      updatedAtMs: Number(row['updatedAtMs'])
    }
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
  }

  count(): number {
    return Number(
      Object.values(
        this.db.prepare('SELECT COUNT(*) AS n FROM prompts').get() as Record<string, unknown>
      )[0]
    )
  }
}

// ---------------------------------------------------------------------------
// Batch queues
// ---------------------------------------------------------------------------

export interface QueueRecord {
  id: number
  name: string
  specJson: string
  createdAtMs: number
  updatedAtMs: number
}

export interface QueueSpec {
  name: string
  steps: Array<{
    toolId: string
    options: Record<string, unknown>
  }>
}

export interface QueueSaveInput {
  id?: number
  name: string
  spec: QueueSpec
}

export class QueuesStore {
  constructor(private db: DatabaseSync) {}

  list(): QueueRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, spec_json AS specJson, created_ms AS createdAtMs, updated_ms AS updatedAtMs
         FROM queues ORDER BY updated_ms DESC`
      )
      .all() as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: Number(row['id']),
      name: String(row['name']),
      specJson: String(row['specJson']),
      createdAtMs: Number(row['createdAtMs']),
      updatedAtMs: Number(row['updatedAtMs'])
    }))
  }

  save(input: QueueSaveInput, now: number = Date.now()): QueueRecord {
    if (!input.name.trim()) throw stashError('VALIDATION', 'Queue name is required.')
    if (!input.spec?.steps?.length)
      throw stashError('VALIDATION', 'Queue must have at least one step.')

    const specJson = JSON.stringify(input.spec)
    let id = input.id
    if (id === undefined) {
      const result = this.db
        .prepare('INSERT INTO queues (name, spec_json, created_ms, updated_ms) VALUES (?, ?, ?, ?)')
        .run(input.name.trim(), specJson, now, now)
      id = Number(result.lastInsertRowid)
    } else {
      const result = this.db
        .prepare('UPDATE queues SET name = ?, spec_json = ?, updated_ms = ? WHERE id = ?')
        .run(input.name.trim(), specJson, now, id)
      if (Number(result.changes) === 0) {
        throw stashError('VALIDATION', 'That queue no longer exists.', {
          technicalMessage: `id ${id} not found`
        })
      }
    }
    const row = this.db
      .prepare(
        `SELECT id, name, spec_json AS specJson, created_ms AS createdAtMs, updated_ms AS updatedAtMs
         FROM queues WHERE id = ?`
      )
      .get(id) as Record<string, unknown>
    return {
      id: Number(row['id']),
      name: String(row['name']),
      specJson: String(row['specJson']),
      createdAtMs: Number(row['createdAtMs']),
      updatedAtMs: Number(row['updatedAtMs'])
    }
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM queues WHERE id = ?').run(id)
  }

  count(): number {
    return Number(
      Object.values(
        this.db.prepare('SELECT COUNT(*) AS n FROM queues').get() as Record<string, unknown>
      )[0]
    )
  }
}
