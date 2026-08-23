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

Milestone 2 — demonstration tools on top of the verified foundation. Five tools
shipped: **JSON Formatter** (`json-format`), **Base64 Encoder/Decoder**
(`base64-codec`), **File Metadata Viewer** (`file-metadata`), **Image Preview**
(`image-preview`), and **QR Code Generator** (`qr-generator`) — each as a
definition + lazy view + colocated pure logic with tests (see ADR-015/016).

Milestone 2 batch 2 additions:

- Binary platform bridge: `fs:read-file-bytes` / `fs:write-file-bytes` IPC
  channels (64 MiB hard cap, upfront rejection of oversized reads, writes gated
  by `WriteScopeGuard` like text writes). `ArrayBuffer` crosses the boundary
  via structured clone.
- `image-preview`: single-image DropZone → bytes via the new read channel →
  Blob/object-URL `<img>` with metadata strip (name, natural dimensions,
  humanized size, MIME) and Fit/100%/±25% zoom controls (10%–800%); SVGs are
  rendered inertly through `<img>`.
- `qr-generator`: first external dependency `qrcode` (+ `@types/qrcode`),
  wrapped in pure `generateQrDataUrl()` with fixed scannability palette and
  StashError mapping; UI offers size/error-correction selects, clipboard copy
  (`ClipboardItem` PNG) and Save… through save dialog + binary write channel.

Milestone 2 batch 3 (heavy processing) additions:

- Platform extensions: `dialog:choose-directory` (native folder picker whose
  choice is approved in `WriteScopeGuard`, which now prefix-whitelists writes
  beneath any approved directory) and `fs:export-file` (copy temp-workspace
  output to an approved destination; source must resolve inside the temp root).
- `sharp` + `jszip` adopted as mature processing libraries (prebuilt N-API
  binaries, verified inside Electron via the smoke test).
- `src/main/processing/images.ts`: pure-ish sharp wrappers — `convertImage`
  (png/jpeg/webp/avif/tiff, clamped quality on lossy formats only) and
  `compressImage` (format inferred from extension, PNG palette+level 9,
  optional `withoutEnlargement` downscale), both returning written bytes.
- `src/main/processing/archives.ts`: `createZipArchive` (512 MB input cap,
  collision-safe entry names) and `extractZipArchive` (zip-slip guard: absolute
  paths, drive letters and `..` segments are skipped, plus a resolved-prefix
  defense-in-depth check).
- Batch orchestration channels `images:convert-batch` / `images:compress-batch`
  run the full lifecycle (validate → temp op dir → process → verify → export →
  cleanup) sequentially under the ProgressBus: real per-file ratio + filename,
  cooperative cancellation, per-file success/failure outcomes, total-failure
  escalation to a progress error event.
- ZIP channels `files:zip-create` / `files:zip-extract` behind the same
  validation/writeScope gates.
- Four new tools registered (definitions + lazy views): **Image Converter**
  (`image-convert`), **Image Compressor** (`image-compress`, shows original→new
  size and saved % from pre-fetched stat sizes), **ZIP Creator** (`zip-create`,
  indeterminate progress, no cancellation capability claimed), **ZIP Extractor**
  (`zip-extract`, summary + skipped-entry warnings). Shared batch-tool hooks
  live in `src/renderer/tools/shared/` (accumulating dedupe file list, mount-
  time progress subscription that cannot miss events emitted during the invoke).

## Verification evidence

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --check "src/**/*.{ts,tsx,css}"` → clean.
- `npx vitest run` → **14 files, 105 tests passed** (registry/fuzzy search, error
  normalization, file utils, temp workspace lifecycle, SQLite stores against real
  in-memory DBs, ProgressBus cancellation semantics; per-tool logic suites; plus
  Milestone 2 batch 3: sharp round-trip/quality-clamp/missing-input tests with
  runtime-generated fixtures, and JSZip create/dedupe/zip-slip/corrupt-archive
  tests against real temp directories).
- `npx electron-vite build` → main/preload/renderer all build successfully;
  each tool view emits its own lazy chunk (including `ImageConvertTool`,
  `ImageCompressTool`, `ZipCreateTool`, `ZipExtractTool`), confirming code
  splitting through the registry.
- Headless boot check `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0
  (validates services initialize — including sharp and jszip imports — and SQLite
  opens inside the Electron main process).

## Notes

- Do not treat the initial tool catalog as exhaustive. New tools can be added after the architecture is proven.
- Do not expand MVP scope merely because additional utilities are easy to imagine.
- Installer packaging (electron-builder) is intentionally deferred; the production build pipeline itself is proven.
