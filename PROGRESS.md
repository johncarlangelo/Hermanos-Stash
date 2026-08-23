# Hermanos Stash — Progress

## Current milestone

**Milestone 4b — document & image expansion batch (complete).** Milestones 1–3, 4a-i and 4a-ii complete.

## Status

Milestones 1–3 are implemented and independently verified. Milestone 4b adds six
document/image tools (pdf-rotate, pdf-compress, pdf-reorder, images-to-pdf,
pdf-to-images, image-exif) on the existing pdf-lib/pdf.js/zip infrastructure,
with one new dependency (`exifr`) for EXIF parsing in the renderer. All
verification gates pass (see evidence below).

Remaining open items (tracked in TASKS.md): dedicated tag-filter UI (`[-]`),
installer packaging workflow (`[-]`), WebP tools, UUID generator.

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

Milestone 4b (document & image expansion batch) is complete — six new tools plus
shared infrastructure extensions:

- `parsePageSequence` added beside (not replacing) `parsePageRanges`: same
  "1-3, 7" grammar but returning a FLAT ordered array exactly as written
  ("3,1" means page 3 first) with duplicate rejection. Fully tested for order,
  duplicates, out-of-range and malformed input.
- `pdf-rotate` + `pdf:rotate`: cumulative rotation `(existing + angle) mod 360`
  over 'all' or any sequence subset via pdf-lib `setRotation`; UI mirrors the
  splitter (info line, live sequence validation, angle select, save dialog).
- `pdf-compress` + `pdf:compress`: deliberately lossless-only structural
  optimization (`useObjectStreams`); UI states exactly that and reports a size
  increase neutrally instead of a success badge.
- `pdf-reorder` + `pdf:reorder`: builds a NEW document copying pages in exact
  parsed-sequence order ('all' rejected — no ordering intent); output page
  count equals the requested sequence length.
- `images-to-pdf` + `pdf:images-to-pdf`: one full-bleed page per JPG/PNG at its
  natural pixel size (`embedJpg`/`embedPng` by extension), ordered queue UI
  copied from PDF Merger.
- `pdf-to-images`: renderer-driven pdf.js rendering through a newly extracted
  shared bootstrap `tools/shared/pdfjs.ts` (preview refactored onto it);
  .zip destination approved by save dialog BEFORE rendering; pages render to
  canvas → blob → temp operation dir as page-001.png… then pack via the
  existing zip archive channel; local between-page cancellation with cleanup
  in `finally`.
- `image-exif`: first use of `exifr` (types bundled), parsing in the RENDERER
  over bytes from the existing 64 MiB read bridge; curated grouped display rows
  (~15 tags across Camera/Date/Location/Technical), fraction shutter speeds,
  six-decimal GPS shown text-only with copy (no external link), copy-all-as-JSON,
  honest empty state when metadata is absent.

## Previous focus — Milestone 4a-ii

Five developer tools (ADR-023): `regex-tester` (never-throws evaluator with
termination guarantees), `jwt-decoder` (per-stage decode errors, explicit
not-verified notice), `timestamp-converter` (s/ms auto-detect, injectable now),
`hash-generator` (first crypto IPC domain via node:crypto, streamed file digests)
and `url-utils` (component parser, URIError-safe encode/decode). See ADR-023 for
the full record.

## Previous focus — Milestone 4a-i

Four renderer-side text tools following the pure-logic + lazy-view pattern (ADR-022):

- `markdown-preview`: marked (gfm/breaks) → DOMPurify-sanitized live preview with a
  local minimal prose style, Copy-HTML action and word/char footer.
- `yaml-json`: js-yaml `load(json:true)`/`dump(indent:2)` both directions, structured
  1-based line/column errors from `YAMLException.mark`, Base64-style direction
  segmented control with output-carrying swap.
- `csv-json`: hand-written strict RFC 4180 parser/serializer (quoted fields, `""`
  escapes, embedded commas/newlines, CRLF normalization, trailing-newline tolerance,
  unclosed-quote line errors), CSV→JSON/JSON→CSV with header-row toggle and
  comma/semicolon/tab delimiter select; malformed-JSON errors reuse
  `positionToLineColumn` from json-format.
- `text-diff`: LCS line diff over a flat Int32Array DP table, guarded at 2000 lines
  per side (`{ error: 'too large' }` honest empty state), explicit Compute action,
  unified rows (+/− markers with bg tints and sr-only descriptions), summary line.

## Previous focus — Milestone 3

- `src/main/services/ffmpeg.ts`: binary management with bundled-first resolution
  (`resources/ffmpeg` — packaged `resourcesPath` then dev `appPath`, extensionless
  fallbacks for cross-platform future), system-PATH fallback via spawned
  `-version` probes (5 s timeout), result cached after first success; pure helpers
  (`candidateDirs`, `findBundledBinaries`, `parseVersionLine`) are Electron-free
  and unit tested.
- ProgressBus extended with `onCancel(operationId, fn)`: handlers fire exactly
  once on cancel and are cleared on done/fail/cancel — media operations use it to
  kill a spawned ffmpeg instantly instead of waiting for the next poll tick.
- `src/main/processing/media.ts`: pure parsers (`parseFfprobeJson` against a
  realistic fixture, `parseFfmpegProgressLine`, `out_time_us/ms/out_time` ratio
  math incl. the historical µs/mislabel quirk, CRF/bitrate clamps, scale-filter
  builder); spawn-based `runFfmpeg` (`-progress pipe:1 -nostats`, 500 ms cancel
  poll + instant hook kill, stderr tail surfaced in structured errors);
  high-level ops `convertVideo` (x264/vp9 + aac/opus), `compressVideo`
  (aspect-preserving cap filter), `videoToGif` (two-pass palettegen/paletteuse,
  progress split 15/85 across passes), `extractAudio`/`convertAudio` (-vn map,
  wav=pcm_s16le, aac→.m4a); every output re-probed by `verifyOutputMedia`
  (container/stream kind + duration within ±10%) before export.
- IPC channels `media:get-capabilities`, `media:probe`, `media:convert-video`,
  `media:compress-video`, `media:video-to-gif`, `media:extract-audio`,
  `media:convert-audio`; single-input ops keep the plural batch result shape;
  missing binaries produce an actionable error mentioning `resources/ffmpeg`.
- Shared single-file media tool workspace (`shared/media-tool.tsx`): capability
  gating with honest FFmpeg-not-found EmptyState, auto-probe info line
  (duration · resolution · codec · size), options panel injection, progress +
  cancel binding, original→new size + saved %, "Output verified" SuccessNote,
  history records and toast summaries.
- Five tools registered: **Video Converter** (`video-convert`, CRF 18–40 slider),
  **Video Compressor** (`video-compress`, preset + max-resolution selects),
  **Video → GIF** (`video-to-gif`, fps/width selects + one-line size caveat),
  **Audio Extractor** (`extract-audio`) and **Audio Converter**
  (`audio-convert`) in the audio category.
- No new npm dependencies for the platform: ffmpeg.exe/ffprobe.exe are spawned
  directly via `child_process.spawn`.

Next up when work resumes: remaining Milestone 4 candidates per TASKS.md, plus
the two open `[-]` items (tag-filter UI, installer packaging).

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

Milestone 4b gates (latest run):

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --write "src/**/*.{ts,tsx,css}"` → applied; check clean.
- `npx vitest run` → **29 files, 313 tests passed** (up from 27 files / 273 tests:
  +40 new tests — parsePageSequence ordering/duplicate/range/malformed suites;
  pdf-lib rotate (cumulative + subset + persisted rotation), compress
  (lossless round-trip, same pageCount), reorder (geometry-proven page order,
  out-of-range rejection) and images-to-pdf (natural page sizes, one image
  object per page, extension and corrupt-byte rejection); pdf-to-images logic
  (page-001 padding, format mapping, quality clamps); image-exif logic (fraction
  exposure, GPS decimals, section grouping/omission). Includes the tool catalog
  integrity suite over all six new registrations.
- `npx electron-vite build` → main/preload/renderer all build; each new tool
  emits its own lazy chunk (`PdfRotateTool`, `PdfCompressTool`, `PdfReorderTool`,
  `ImagesToPdfTool`, `PdfToImagesTool`, `ImageExifTool`) plus the shared `pdfjs`
  chunk now shared by preview and exporter.
- Headless boot `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0.

Milestone 4a-ii gates (earlier run):

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --write "src/**/*.{ts,tsx,css}"` → applied; check clean.
- `npx vitest run` → **27 files, 273 tests passed** (up from 22 files / 199 tests:
  +74 new tests across the five new logic suites — valid/invalid/empty/boundary
  coverage for each), including the tool catalog integrity suite over the five new
  registrations (definition ⇄ component ⇄ registry consistency).
- `npx electron-vite build` → main/preload/renderer all build; each new tool emits
  its own lazy chunk (`RegexTesterTool`, `JwtDecoderTool`, `TimestampConverterTool`,
  `HashGeneratorTool`, `UrlUtilsTool`).
- Headless boot `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0.

Milestone 4a-i gates (earlier run):

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --write "src/**/*.{ts,tsx,css}"` → applied; check clean.
- `npx vitest run` → **22 files, 199 tests passed** (up from 18 files / 145 tests:
  +54 new tests across the four new logic suites — valid/invalid/empty/boundary
  coverage for each), including the tool catalog integrity suite over the four new
  registrations (definition ⇄ component ⇄ registry consistency).
- `npx electron-vite build` → main/preload/renderer all build; each new tool emits
  its own lazy chunk (`MarkdownPreviewTool`, `YamlJsonTool`, `CsvJsonTool`,
  `TextDiffTool`).
- Headless boot `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0.

Milestone 3 gates (earlier run):

- `npx tsc --noEmit -p tsconfig.json` → clean.
- `npx eslint .` → clean.
- `npx prettier --write "src/**/*.{ts,tsx,css}"` → applied; check clean.
- `npx vitest run` → **18 files, 145 tests passed**, including: ProgressBus
  cancel-hook tests (fires exactly once on cancel, never on done); ffprobe JSON
  fixture parsing; ffmpeg progress-line/timestamp/ratio parsers; CRF/bitrate
  clamps and scale-filter builder; verifyMediaInfo kind/duration-tolerance
  suites; version-line + candidate-dir helpers; and the **guarded integration
  test which ran against the real bundled binaries** (generated a 0.5 s
  `testsrc` MP4 via lavfi, converted it to WebM, re-probed and verified the
  output, extracted WAV audio and asserted duration ≈0.5 s ±0.2 s — 449 ms).
  On machines without binaries the integration test returns silently so CI
  stays green.
- `npx electron-vite build` → main/preload/renderer all build; each new tool
  emits its own lazy chunk (`VideoConvertTool`, `VideoCompressTool`,
  `VideoGifTool`, `AudioExtractTool`, `AudioConvertTool`, shared `media-tool`).
- Headless boot `npx electron . --smoke-test` → prints `STASH_SMOKE_OK`, exit 0.

Earlier Milestone 2 evidence:

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
- Independent adversarial verification (@verifier): re-ran every gate with matching
  results; confirmed registry integrity (zero orphan definitions/components, exactly
  the claimed tool list), renderer boundary integrity under pattern grep, test
  quality (processing tests assert real outputs), and TASKS.md accuracy. Verdict: PASS.
- Known limitation honestly recorded: automated gates cover build/test/security;
  a human visual QA pass over the running app (keyboard nav feel, DESIGN.md visual
  compliance on real displays) is recommended before calling this "shipped" rather
  than "engineering-complete".

## Notes

- Do not treat the initial tool catalog as exhaustive. New tools can be added after the architecture is proven.
- Do not expand MVP scope merely because additional utilities are easy to imagine.
- Installer packaging (electron-builder) is intentionally deferred; the production build pipeline itself is proven.
