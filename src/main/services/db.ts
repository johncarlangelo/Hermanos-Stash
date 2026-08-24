import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

/**
 * Local persistence via the Node built-in SQLite engine (`node:sqlite`).
 *
 * Design notes:
 * - The database file lives inside Electron's `userData` directory.
 * - Only metadata is persisted (preferences, favorites, recents, history).
 *   File contents are never stored (PRD §8).
 * - Migrations run in order; `PRAGMA user_version` tracks the applied level.
 */

export const CURRENT_SCHEMA_VERSION = 2

const MIGRATIONS: string[] = [
  // v1: initial schema
  `
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    tool_id TEXT PRIMARY KEY,
    added_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recents (
    tool_id TEXT PRIMARY KEY,
    last_used_ms INTEGER NOT NULL,
    uses INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ms INTEGER NOT NULL,
    tool_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    inputs_json TEXT NOT NULL,
    outputs_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
    duration_ms INTEGER,
    message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity (timestamp_ms DESC);
  `,
  // v2: prompt library
  `
  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_ms INTEGER NOT NULL,
    updated_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts (updated_ms DESC);
  `
]

export interface OpenedDatabase {
  db: DatabaseSync
  file: string
}

export function openDatabase(userDataFolder: string): OpenedDatabase {
  // ':memory:' passes the location straight through (used by tests).
  const file = userDataFolder === ':memory:' ? ':memory:' : path.join(userDataFolder, 'stash.db')
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  const row = db.prepare('PRAGMA user_version').get() as Record<string, unknown> | undefined
  let version = Number(row?.['user_version'] ?? 0)

  while (version < MIGRATIONS.length) {
    db.exec('BEGIN;')
    try {
      db.exec(MIGRATIONS[version]!)
      version += 1
      db.exec(`PRAGMA user_version = ${version};`)
      db.exec('COMMIT;')
    } catch (err) {
      db.exec('ROLLBACK;')
      throw err
    }
  }

  return { db, file }
}
