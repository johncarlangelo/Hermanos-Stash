import type { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AssetCategory,
  AssetFilter,
  AssetRecord,
  HistoryEntry,
  HistoryEntryInput
} from '../../shared/ipc'
import { stashError } from '../../shared/errors'
import { guessMimeType } from '../../shared/utils/files'

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

// ---------------------------------------------------------------------------
// Asset Stash (Local File References - ADR-033)
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif',
  '.tiff',
  '.tif'
])
const DOCUMENT_EXTS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.odt',
  '.epub',
  '.rtf'
])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.wmv'])
const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.7z', '.rar', '.bz2'])
const CODE_EXTS = new Set([
  '.json',
  '.xml',
  '.txt',
  '.md',
  '.csv',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.yaml',
  '.yml',
  '.sql',
  '.sh',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h'
])

export function inferAssetType(filename: string): AssetCategory {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return 'other'
  const ext = filename.slice(dot).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (DOCUMENT_EXTS.has(ext)) return 'document'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (ARCHIVE_EXTS.has(ext)) return 'archive'
  if (CODE_EXTS.has(ext)) return 'code'
  return 'other'
}

export class AssetStashStore {
  constructor(private db: DatabaseSync) {}

  list(filter?: AssetFilter): AssetRecord[] {
    let query = 'SELECT * FROM asset_stash'
    const whereClauses: string[] = []
    const params: unknown[] = []

    if (filter?.type && filter.type !== 'all') {
      whereClauses.push('file_type = ?')
      params.push(filter.type)
    }

    if (filter?.favorite) {
      whereClauses.push('favorite = 1')
    }

    if (filter?.search && filter.search.trim()) {
      whereClauses.push('(file_name LIKE ? OR file_path LIKE ? OR tags_json LIKE ?)')
      const pattern = `%${filter.search.trim()}%`
      params.push(pattern, pattern, pattern)
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`
    }

    query += ' ORDER BY last_accessed_ms DESC, id DESC'

    const limit = Math.max(1, Math.min(filter?.limit ?? 500, 1000))
    query += ` LIMIT ${limit}`

    if (filter?.offset && filter.offset > 0) {
      query += ` OFFSET ${filter.offset}`
    }

    const stmt = this.db.prepare(query)
    const rows = (stmt.all as (...args: unknown[]) => Array<Record<string, unknown>>)(...params)
    return rows.map((row) => this.mapRow(row))
  }

  add(filePath: string, sourceToolId?: string, tags: string[] = [], now = Date.now()): AssetRecord {
    const cleanPath = path.resolve(filePath)
    let size = 0
    let exists = false

    try {
      if (fs.existsSync(cleanPath)) {
        exists = true
        const st = fs.statSync(cleanPath)
        size = st.size
      }
    } catch {
      // Ignored if file unreadable
    }

    const fileName = path.basename(cleanPath)
    const fileType = inferAssetType(fileName)
    const mimeType = guessMimeType(fileName)
    const tagsJson = JSON.stringify(tags)

    this.db
      .prepare(
        `INSERT INTO asset_stash (
          file_path, file_name, file_size, file_type, mime_type,
          source_tool_id, favorite, tags_json, added_ms, last_accessed_ms
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          file_size = excluded.file_size,
          last_accessed_ms = excluded.last_accessed_ms,
          source_tool_id = COALESCE(excluded.source_tool_id, asset_stash.source_tool_id)`
      )
      .run(cleanPath, fileName, size, fileType, mimeType, sourceToolId ?? null, tagsJson, now, now)

    const row = this.db
      .prepare('SELECT * FROM asset_stash WHERE file_path = ?')
      .get(cleanPath) as Record<string, unknown>

    const record = this.mapRow(row)
    record.exists = exists
    return record
  }

  addBatch(filePaths: string[], sourceToolId?: string, now = Date.now()): AssetRecord[] {
    const results: AssetRecord[] = []
    for (const p of filePaths) {
      if (typeof p === 'string' && p.trim()) {
        try {
          results.push(this.add(p.trim(), sourceToolId, [], now))
        } catch {
          // skip invalid file paths
        }
      }
    }
    return results
  }

  toggleFavorite(id: number): boolean {
    const row = this.db.prepare('SELECT favorite FROM asset_stash WHERE id = ?').get(id) as
      Record<string, unknown> | undefined
    if (!row) return false
    const newFav = Number(row['favorite']) === 1 ? 0 : 1
    this.db.prepare('UPDATE asset_stash SET favorite = ? WHERE id = ?').run(newFav, id)
    return newFav === 1
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM asset_stash WHERE id = ?').run(id)
  }

  checkExistence(id: number): { id: number; exists: boolean } {
    const row = this.db.prepare('SELECT file_path FROM asset_stash WHERE id = ?').get(id) as
      Record<string, unknown> | undefined
    if (!row) return { id, exists: false }
    const cleanPath = String(row['file_path'])
    try {
      return { id, exists: fs.existsSync(cleanPath) }
    } catch {
      return { id, exists: false }
    }
  }

  cleanupMissing(): number {
    const rows = this.db.prepare('SELECT id, file_path FROM asset_stash').all() as Array<
      Record<string, unknown>
    >
    let removed = 0
    for (const row of rows) {
      const id = Number(row['id'])
      const filePath = String(row['file_path'])
      try {
        if (!fs.existsSync(filePath)) {
          this.db.prepare('DELETE FROM asset_stash WHERE id = ?').run(id)
          removed++
        }
      } catch {
        this.db.prepare('DELETE FROM asset_stash WHERE id = ?').run(id)
        removed++
      }
    }
    return removed
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM asset_stash').get() as Record<
      string,
      unknown
    >
    return Number(row?.['n'] ?? 0)
  }

  private mapRow(row: Record<string, unknown>): AssetRecord {
    const filePath = String(row['file_path'])
    let exists: boolean | undefined
    try {
      exists = fs.existsSync(filePath)
    } catch {
      exists = false
    }

    return {
      id: Number(row['id']),
      filePath,
      fileName: String(row['file_name']),
      fileSize: Number(row['file_size']),
      fileType: String(row['file_type']) as AssetCategory,
      mimeType: row['mime_type'] ? String(row['mime_type']) : null,
      sourceToolId: row['source_tool_id'] ? String(row['source_tool_id']) : null,
      favorite: Number(row['favorite']) === 1,
      tags: readJsonArray(row['tags_json']),
      addedMs: Number(row['added_ms']),
      lastAccessedMs: Number(row['last_accessed_ms']),
      exists
    }
  }
}
