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

Milestone 2 batch 4 (PDF suite) additions:

- `pdf-lib` adopted for main-process PDF manipulation, `pdfjs-dist` (v6) for
  renderer-side rendering only — both mature libraries per AGENTS.md principle 12.
- `src/main/processing/pdf.ts`: `mergePdfs` (ordered page copy into one target,
  encrypted inputs rejected with an actionable error naming the file and
  suggesting protection removal), `getPdfInfo` (page count + on-disk size), and
  `splitPdfPages` (one output PDF per page group). Lenient pdf-lib parsing is
  hardened by forcing page-tree access at load time so corrupt documents fail
  with structured errors instead of mid-merge.
- `src/shared/utils/page-ranges.ts`: pure parser for "1-3, 7, 10-12" specs —
  1-based inclusive ranges, whitespace tolerant, out-of-range/backwards/malformed
  input each produce a distinct actionable error; overlapping groups are allowed
  but deduped preserving first-appearance order (fully-duplicated groups are
  dropped so no empty output can ever be produced).
- Channels `pdf:merge-batch` (512 MB total input cap, `.pdf` extension check,
  writeScope-gated save target), `pdf:get-info`, and `pdf:split` (authoritative
  re-validation against the real page count; temp op dir → one PDF per group →
  collision-suffixed export exactly like the image batch; per-group progress
  events and cancellation between groups).
- Three new tools registered: **PDF Merger** (`pdf-merge`, ordered queue with
  numbered rows and up/down reordering buttons, save-dialog → summary flow like
  zip-create), **PDF Splitter** (`pdf-split`, document info line fetched via
  `pdf:get-info`, live range-spec validation using the shared parser, progress
  bar + cancel during splitting), and **PDF Preview** (`pdf-preview`, pdf.js
  canvas rendering with worker loaded via Vite `?url` asset import — buffer is
  copied before handing to pdf.js since it may transfer/detach it — Fit/100%
  zoom, prev/next with keyboard Left/Right support, loading spinner, encrypted/
  corrupt error states, full cleanup of render tasks and loading tasks on unmount
  and file change).

## Verification evidence

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --check "src/**/*.{ts,tsx,css}"` → clean.
- `npx vitest run` → **16 files, 118 tests passed** (registry/fuzzy search, error
  normalization, file utils, temp workspace lifecycle, SQLite stores against real
  in-memory DBs, ProgressBus cancellation semantics; per-tool logic suites;
  sharp round-trip/quality-clamp/missing-input tests with runtime-generated
  fixtures; JSZip create/dedupe/zip-slip/corrupt-archive tests; page-range
  parser valid/invalid/boundary/dedupe suites; pdf-lib merge/split/info/encrypted/
  corrupt tests with runtime-generated fixtures).
- `npx electron-vite build` → main/preload/renderer all build successfully;
  each tool view emits its own lazy chunk (including the PDF suite), confirming
  code splitting through the registry; the pdf.js worker resolves via a Vite
  `?url` asset import into its own emitted chunk.
- Headless boot check `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0
  (validates services initialize — including sharp, jszip and pdf-lib imports — and
  SQLite opens inside the Electron main process).

## Notes

- Do not treat the initial tool catalog as exhaustive. New tools can be added after the architecture is proven.
- Do not expand MVP scope merely because additional utilities are easy to imagine.
- Installer packaging (electron-builder) is intentionally deferred; the production build pipeline itself is proven.
