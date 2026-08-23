# Hermanos Stash — Progress

## Current milestone

**Milestone 1 — Foundation (complete, pending installer packaging)**

## Status

The application foundation is implemented and verified: Electron shell with secure
boundaries, React + TypeScript + Vite renderer, Tailwind v4 design tokens, the full
application shell (sidebar, command palette search, categories, favorites, recents),
and the local platform layer (IPC bridge, dialogs, filesystem access, temp workspace,
progress/cancellation model, SQLite persistence via `node:sqlite`, activity history,
toast notifications).

## Completed

- Product concept defined.
- Local-first desktop direction selected.
- No-account MVP selected.
- Favorites and local activity history selected.
- Search/filter/tag discovery selected.
- Modular tool architecture selected.
- Dark-only premium design direction selected.
- Tailwind CSS + CSS Modules + design tokens styling stack selected.
- AI API excluded from MVP.
- MVP tool set selected and category taxonomy standardized.
- OpenCode autonomous workflow defined.
- Project skills installed under `.opencode/skills/` and integrated into `AGENTS.md`, `LOOP.md`, and specialized subagents.
- Specifications cross-verified and inconsistencies resolved.

### Milestone 1 implementation (this phase)

- Project scaffolded: Electron 43 + React 19 + TypeScript + Vite 7 via electron-vite.
- Main/preload/renderer boundaries established; sandbox + contextIsolation enabled;
  narrow typed IPC surface only (`src/shared/ipc.ts` is the single contract).
- Design tokens implemented in CSS (`--color-*`, `--font-*`, `--radius-*`) per DESIGN.md;
  layered charcoal palette, single warm accent, no pure black.
- Core controls: Button, IconButton, Input/TextArea/Select/FieldRow/Toggle/TagChip,
  compact contextual DropZone, ProgressBar, EmptyState, ErrorNote/SuccessNote, toasts.
- Application shell: persistent sidebar (favorites/recent/categories), Ctrl+K command
  palette with fuzzy search, home workspace view, category-filtered view, tool pages,
  settings shell with real functions (version info, data folder reveal, clear history).
- Tool registry (`ToolRegistry`) with validation, fuzzy scoring, category/tag indexes.
- Local platform: open/save dialogs, stat/read/write text file bridge, temp workspace
  manager (stale purge + quit cleanup), ProgressBus with cooperative cancellation,
  structured error normalization across IPC, SQLite storage (prefs/favorites/recents/
  history) via built-in `node:sqlite` — no native compilation required.

## Current focus

Milestone 2 — demonstration tools on top of the verified foundation. First three
tools shipped: **JSON Formatter** (`json-format`), **Base64 Encoder/Decoder**
(`base64-codec`), and **File Metadata Viewer** (`file-metadata`) — each as a
definition + lazy view + colocated pure logic with tests (see ADR-015/016).

## Verification evidence

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --check "src/**/*.{ts,tsx,css}"` → clean.
- `npx vitest run` → **10 files, 80 tests passed** (registry/fuzzy search, error
  normalization, file utils, temp workspace lifecycle, SQLite stores against real
  in-memory DBs, ProgressBus cancellation semantics; plus per-tool logic suites:
  JSON format/validate with line-column extraction, Base64 UTF-8 round-trips and
  decode tolerances, file-metadata row building and relative-time formatting).
- `npx electron-vite build` → main/preload/renderer all build successfully;
  each tool view emits its own lazy chunk (`JsonFormatTool`, `Base64Tool`,
  `FileMetadataTool`), confirming code splitting through the registry.
- Headless boot check `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0
  (validates services initialize and SQLite opens inside the Electron main process).

## Notes

- Do not treat the initial tool catalog as exhaustive. New tools can be added after the architecture is proven.
- Do not expand MVP scope merely because additional utilities are easy to imagine.
- Installer packaging (electron-builder) is intentionally deferred; the production build pipeline itself is proven.
