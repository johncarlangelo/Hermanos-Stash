# Hermanos Stash — Architecture Decision Record

## ADR-001 — Installed desktop application

**Decision:** Build Stash as a desktop application rather than a hosted web application.

**Reason:** The product needs reliable local filesystem access and local processing for files and media.

## ADR-002 — Electron

**Decision:** Use Electron for the desktop runtime.

**Reason:** Stash is primarily a TypeScript/React application with substantial native filesystem and process requirements. Electron provides a mature Chromium + Node.js environment and keeps the implementation approachable for a JS/TS-heavy project.

## ADR-003 — React + TypeScript + Vite

**Decision:** Use React, TypeScript, and Vite.

**Reason:** The application has many interactive tool workspaces and benefits from component reuse, strict typing, and fast development.

## ADR-004 — Tailwind CSS with design tokens and skills-guided styling

**Decision:** Use Tailwind CSS configured with custom design tokens, complemented by CSS Modules where scoped styling is beneficial, guided by `DESIGN.md` and installed skills (`taste-skill`, `ui-ux-pro-max`, `awesome-design-md`).

**Reason:** Allows leveraging installed UI/UX skills and rapid utility styling while strictly adhering to the dark-only, restrained, and anti-slop design system defined in `DESIGN.md`.

## ADR-005 — Local-first

**Decision:** Process files locally whenever technically practical.

**Reason:** Privacy, offline usefulness, no server costs, and the project's experimental side-project nature.

## ADR-006 — No accounts

**Decision:** MVP requires no user account.

**Reason:** Accounts provide little value for a local-first utility application at this stage.

## ADR-007 — Local activity history

**Decision:** Include lightweight local history.

**Reason:** Users may want to remember what tool they used and what they produced. Do not store file contents.

## ADR-008 — Modular tool registry

**Decision:** Tools are registered through a common tool architecture.

**Reason:** The product's long-term value depends on adding many tools without creating an unmaintainable monolith.

## ADR-009 — No paid AI API

**Decision:** AI-powered features are excluded from the MVP.

**Reason:** This is a side project and should remain inexpensive and self-contained. AI-adjacent utilities may be added later without requiring a remote AI service.

## ADR-010 — MVP proves architecture before scale

**Decision:** Start with a medium-sized set of representative tools rather than the full catalog.

**Reason:** The important first proof is that the architecture can support multiple categories and processing models cleanly.

## ADR-011 — SQLite via Node built-in `node:sqlite`

**Decision:** Use the `node:sqlite` module built into Electron's bundled Node.js runtime instead of a native dependency such as better-sqlite3.

**Reason:** It is real SQLite (same engine, WAL mode, prepared statements) without native compilation or ABI rebuilds against Electron. This removes the most fragile part of an Electron toolchain on contributor machines. The storage layer is isolated behind stores in the main process, so swapping engines later would be local.

## ADR-012 — electron-vite as the build orchestrator

**Decision:** Use `electron-vite` to build main, preload, and renderer from one config.

**Reason:** It encodes the standard three-process Electron layout with Vite HMR in development and production builds, avoiding hand-rolled multi-target build scripts.

## ADR-013 — Frameless window via native `titleBarOverlay`

**Decision:** Hide the OS title bar but keep native window controls through `titleBarStyle: hidden` + `titleBarOverlay` on Windows (`hiddenInset` on macOS).

**Reason:** Gives the app a custom top region consistent with DESIGN.md while keeping reliable native snap/close/minimize behavior; avoids hand-rolled window-control IPC for now.

## ADR-014 — Zustand for renderer state

**Decision:** Use Zustand for navigation, library (favorites/recents), and toast state.

**Reason:** Minimal API surface, no provider nesting, trivially testable selectors — appropriate scale for a single-window utility suite.

## ADR-015 — Tools ship as definition + lazy view + colocated pure logic

**Decision:** Each tool contributes a `ToolDefinition` registered in `src/renderer/tools/index.ts`, a default-exported lazily-loaded view component, and pure logic colocated in the tool folder (`logic.ts` + `logic.test.ts`) with no React/DOM coupling. Tool UIs compose shared primitives (`Button`, `Inputs`, `Feedback`, `DropZone`, `IconButton`, toasts) and never re-implement them.

**Reason:** Keeps the shell decoupled from implementations (code-split chunks per tool in production builds), makes conversion/format logic unit-testable without mounting components, and enforces the shared design system (TOOL_SPEC.md → UI contract). Proven by the first three tools: `json-format`, `base64-codec`, `file-metadata`.

## ADR-016 — JSON/Base64 text processing stays renderer-side with documented tolerances

**Decision:** JSON formatting/validation uses `JSON.parse`/`JSON.stringify` directly in the renderer, deriving error line/column from V8 messages ("at position N" recomputed by newline counting; "(line L column C)" hint as fallback; 1-based coordinates matching editor conventions). Base64 encoding routes UTF-8 through `TextEncoder`/`TextDecoder` (fatal decoding) instead of raw `btoa`/`atob`; decode tolerates missing padding and embedded whitespace but rejects invalid characters and non-UTF-8 byte sequences.

**Reason:** Both operations are instant on realistic inputs, need no native code, and keep files local-first. Documenting tolerance decisions in tests prevents silent behavior drift between contributors.

## ADR-017 � Binary file channels mirror the text channels

**Decision:** Add symmetric binary IPC channels `fs:read-file-bytes` and `fs:write-file-bytes` alongside the existing text pair. Reads validate `path`/`maxBytes`, reject files larger than 64 MiB upfront with a clear validation error (rather than silently truncating), and return a standalone `ArrayBuffer` sliced from the read buffer so no oversized parent allocation crosses IPC. Writes accept `ArrayBuffer`/typed views, enforce the same 64 MiB cap, and pass through `WriteScopeGuard.assertAllowed` exactly like text writes. The renderer bridge exposes them as `window.stash.fs.readFileBytes` / `writeFileBytes`.

**Reason:** Image preview and QR saving need raw bytes; encoding binaries as text would be lossy or wasteful. `ArrayBuffer` is structured-clonable in Electron IPC, so bytes travel without base64 overhead. Mirroring the established handler shape (validation ? scope guard ? fs.promises handle) keeps the security posture uniform across every filesystem channel.

## ADR-018 � QR generation via the mature `qrcode` package, renderer-side

**Decision:** Use `qrcode` (+ `@types/qrcode`) as the sole new dependency for Milestone 2 batch 2. Pure logic wraps `QRCode.toDataURL` in `generateQrDataUrl()` with fixed options (margin 2, width default 512, error correction M, near-black modules on warm paper for scannability). Empty input and library capacity errors are mapped to `StashError` (`VALIDATION`) with actionable messages; tests cover rejection paths and PNG data-URL output for text, URLs, and long payloads.

**Reason:** Hand-rolling QR encoding is high-risk and unnecessary (AGENTS.md principle 12); `qrcode` is mature and dependency-free. Keeping generation renderer-side preserves local-first behavior, and centralizing option/error policy in one pure function makes the tool UI trivial and testable.

## ADR-019 — Heavy file processing in main-process services with a shared batch lifecycle

**Decision:** Add src/main/processing/ for heavy processors (images.ts over sharp, rchives.ts over jszip) and orchestrate batches through dedicated IPC channels that run the full lifecycle — validate → 	emp.createOperation → process → verify output exists → export to the user-approved folder → 	emp.cleanup — under the existing ProgressBus with cooperative cancellation. Exports are gated by two new primitives: dialog:choose-directory (whose choice is approved in the guard, which now prefix-whitelists everything beneath an approved directory) and s:export-file (source must resolve inside the temp root; target must pass ssertAllowed). Batch results are structured per-file outcomes (succeeded/ailed/cancelled) so one bad file never fails the batch.

**Reason:** Keeps renderer code browser-safe and long-running work out of the UI thread (ARCHITECTURE.md → Long-running work), reuses the proven temp-workspace + write-scope + progress primitives instead of inventing new ones, and gives every future heavy tool (PDF, media) a single pattern to follow.

## ADR-020 — sharp and jszip as the image/archive engines

**Decision:** Adopt sharp (prebuilt N-API binaries) for image conversion/compression and jszip for archive creation/extraction. Compression infers format from extension (PNG stays lossless via palette + compression level 9; quality applies only to jpeg/webp/avif); resizing uses it: inside + withoutEnlargement. Extraction rejects zip-slip entries (absolute paths, drive letters, .. segments) by skipping them and reporting warnings rather than failing.

**Reason:** Both are mature, widely deployed libraries (AGENTS.md principle 12). Sharp ships prebuilt binaries so no Electron ABI rebuild is needed — verified by the smoke test. Skipping unsafe zip entries matches TOOL_SPEC.md's warning-oriented result model: users get everything safe plus an explicit list of what was refused.

## ADR-021 - PDF suite split across pdf-lib (main) and pdf.js (renderer)

**Decision:** Milestone 2 batch 4 adds three PDF tools using two mature libraries with a strict process split. `pdf-lib` runs in the main process only (`src/main/processing/pdf.ts`): `mergePdfs` copies pages in order into one target, `getPdfInfo` reports page count/size, and `splitPdfPages` writes one output per page group; encrypted documents are detected at load and rejected with an error naming the file and suggesting protection removal, while pdf-lib's lenient parsing is hardened by forcing page-tree access at load time so corrupt files fail with structured errors instead of mid-operation. `pdfjs-dist` runs in the renderer only for preview: the worker loads via a Vite `?url` asset import (`GlobalWorkerOptions.workerSrc`), bytes arrive through the existing 64 MiB `fs:read-file-bytes` channel and are copied before being handed to pdf.js because it may transfer/detach the buffer, and render tasks + loading tasks are destroyed/cancelled on unmount and file change. Page-range syntax ("1-3, 7") lives in a shared pure parser (`src/shared/utils/page-ranges.ts`) used for live UI validation and re-validated authoritatively in main against the real page count; overlapping groups dedupe preserving order so no empty output file can be produced.

**Reason:** Both libraries are the de-facto standards for their half of the problem (AGENTS.md principle 12). Splitting them by process keeps heavy manipulation out of the renderer and rendering out of the main process (ARCHITECTURE.md - Performance), reuses ADR-019's temp-workspace/write-scope/progress lifecycle unchanged for merge/split batches, and keeps the range grammar testable and reusable for future PDF tools (page extraction/reorder are Milestone 4 candidates).

## ADR-022 - Text expansion batch: marked+DOMPurify, js-yaml, hand-written CSV, LCS diff

**Decision:** Milestone 4a-i adds four text tools as renderer-side pure-logic modules. `markdown-preview` renders via `marked` (gfm + breaks) and sanitizes with `DOMPurify` (html profile, style/form/iframe forbidden) before any `dangerouslySetInnerHTML`; the prose styling is one local Tailwind arbitrary-variant string owned by the tool component. `yaml-json` uses `js-yaml` named imports (`load` with `json: true` so duplicate keys error instead of silently overriding; `dump` indent 2), extracting 1-based line/column from `YAMLException.mark`. `csv-json` uses a hand-written strict RFC 4180 parser/serializer (doubled-quote escaping, delimiter/quote/newline/padding-triggered quoting, CRLF normalized to LF, trailing newline tolerated, unclosed quotes rejected with their opening line number) rather than a dependency. `text-diff` computes a line-level LCS diff with a flat Int32Array DP table guarded at 2000 lines per side, returning `{ error: 'too large' }` instead of degrading the UI.

**Reason:** All four are instant text transforms needing no native code (local-first, ADR-016 pattern). Markdown/HTML injection is the one real security surface in this batch, so DOMPurify sits on the only path into `dangerouslySetInnerHTML`. js-yaml's ESM build has no usable default export under Vite, hence named imports. CSV parsing is small enough that a strict, fully tested hand parser beats adding a sixth dependency for this milestone.

## ADR-023 - Developer expansion batch: pure regex/JWT/timestamp/URL logic plus a crypto IPC domain
**Decision:** Milestone 4a-ii adds five developer tools following the established pure-logic + lazy-view pattern. `regex-tester` never throws: `testRegex` validates flags against the supported JS set `dgimsuvy` (unknown and duplicated letters rejected with messages), compiles in try/catch, iterates exec for global/sticky patterns only, steps past zero-length matches by advancing lastIndex so patterns like `a*` terminate, and caps collection at maxMatches using the explicit sentinel that `total >= maxMatches` means "at least N". `jwt-decoder` splits into 2-3 segments, decodes each base64url segment through bytes → fatal UTF-8 decode → JSON.parse with per-stage error messages, requires JSON objects for header/payload, and treats `exp === now` as expired; the UI states prominently that signatures are not verified. `timestamp-converter` auto-detects seconds vs milliseconds at the >1e11 boundary (documented and tested) and formats relative labels through Intl.RelativeTimeFormat with an injectable now. `url-utils` prepends `https://` when no scheme is present (tested as documented behavior), omits port when default, and wraps encode/decode with URIError-safe results. `hash-generator` introduces the first crypto IPC domain (`crypto:hash-text`, `crypto:hash-file` on StashBridge.crypto): node:crypto runs in main behind an algorithm allowlist, file digests stream via createReadStream chunks instead of whole-file reads, and file hashes record best-effort history entries.

**Reason:** Regex evaluation is the one tool here that can crash or hang on user input, so termination guarantees and typed errors are correctness requirements, not polish (AGENTS.md principle 9). Hashing belongs in main because node:crypto is unavailable in the sandboxed renderer (ARCHITECTURE.md boundary rules) while WebCrypto cannot do MD5; streaming keeps memory flat regardless of file size, matching the local-first promise. JWT decoding deliberately stops short of verification — pretending otherwise would violate principle 11.

## ADR-024 - Milestone 4b document & image batch: exifr, ordered page sequences, honest lossless compression
**Decision:** Milestone 4b adds six tools. `pdf-rotate`/`pdf-reorder` extend the pdf-lib service with cumulative rotation (`(existing + angle) mod 360`) and sequence-ordered page copy; both share a new `parsePageSequence` parser alongside (not replacing) `parsePageRanges` — same grammar but returning a FLAT array exactly as written, rejecting duplicates so every output page is named once ("3,1" means page 3 first). `pdf-compress` is deliberately lossless-only: `save({ useObjectStreams: true })` rewrites structure without touching image data, and the UI states this explicitly and reports a size INCREASE neutrally instead of showing a success badge when re-serialization grows the file. `images-to-pdf` embeds each JPG/PNG at natural pixel size as a full-bleed page via pdf-lib's `embedJpg`/`embedPng`. `pdf-to-images` renders renderer-side through the shared `tools/shared/pdfjs.ts` bootstrap (extracted from pdf-preview, which now imports it), writes numbered pages into a temp operation directory, and packs them with the existing `archives.createZip` after the .zip destination is approved by a save dialog BEFORE rendering starts; cancellation is a local ref checked between pages with temp cleanup in `finally`. `image-exif` introduces `exifr` (types bundled, no @types needed) parsing in the RENDERER over bytes already fetched through the existing 64 MiB-capped read bridge; display grouping/formatting is pure logic (fraction exposure like 1/250, six-decimal GPS coordinates shown text-only with copy — no external link), and zero usable tags yields an honest empty state explaining that screenshots and processed exports strip metadata.

**Reason:** One new dependency for genuinely difficult format handling (AGENTS.md principle 12); everything else rides existing infrastructure (write-scope, temp workspace, zip archive service, save dialogs). The ordered-sequence parser stays separate because reorder semantics (position matters, no repeats) contradict range semantics (dedupe allowed), and merging them would weaken both. Compression honesty follows principle 11: claiming "smaller files" for a structural optimizer that can legitimately grow output would be placeholder-quality deception.

## ADR-025 - Dedicated output-filename inputs across file-producing tools
**Decision:** Post-M4b QoL batch adds a single shared naming contract. `src/renderer/tools/shared/output-name.ts` owns the rules (strip illegal Windows characters plus control chars, collapse whitespace, trim trailing dots/spaces, 120-char cap, case-insensitive extension ensure, reserved device names CON/PRN/AUX/NUL/COM1-9/LPT1-9 rejected with or without an extension, `{name}` pattern substitution) and `OutputNameField.tsx` renders it identically everywhere. Save-dialog tools pass the validated value as the dialog `defaultName` — the dialog itself stays, preserving the write-scope approval model. Media tools gained an optional `fileName` on all five media IPC requests where EMPTY means automatic (source-derived); main re-sanitizes via `parseOptionalFileName` (renderer input is untrusted) and force-matches the extension to the chosen format/codec, discarding whatever extension the user typed. Batch image tools accept `namePattern` (must contain `{name}`, re-checked in main) applied per source stem with existing collision suffixing; absent pattern = exactly today's behavior. Numbered-output tools (pdf-split, pdf-to-images) deliberately receive NO name control, only a dim hint stating the real naming scheme.

**Reason:** One validation module plus one field component keeps twelve tools consistent instead of twelve divergent implementations, and mirrors ADR-019's trust boundary: renderer validation is UX only, main re-validates authoritatively. Extension forcing stays with the format/codec because user-typed extensions would otherwise lie about the actual container. Honest hints over fake controls for inherently numbered outputs follow principle 11.

## ADR-026 - Export-flow quality-of-life set: remembered output folders, reveal/copy-path actions, live zoom preference
**Decision:** Post-M4b QoL round two adds three cross-cutting conveniences without touching any tool's processing path. (1) `tools/shared/use-output-dir.ts` is a per-tool hook persisting the last chosen output directory under prefs key `outDir:<toolId>`; it is adopted once in the shared media scaffold (covering all five FFmpeg tools) and individually in image-convert, image-compress, pdf-split and zip-extract. (2) A new narrow IPC domain `shell:reveal-path` (`StashBridge.shell.revealPath`) resolves the path main-side before `shell.showItemInFolder`, and a tiny shared `result-actions.tsx` (`RevealButton`/`CopyPathButton`) is wired into every output surface: batch/media result rows, pdf-split results, all save-dialog summaries (pdf-merge/compress/rotate/reorder, images-to-pdf, zip-create), zip-extract's output directory, and qr-generator keeps its dialog path in state to power post-save actions. (3) Zoom lives behind `app:set-zoom`: a shared pure helper (`shared/utils/zoom.ts`) clamps 0.8–1.6 and derives the win32 `titleBarOverlay` height as `round(40 × factor)`; main reads `ui.zoom` from prefs BEFORE window creation so startup matches the saved preference, Settings exposes 100/110/125%, and the renderer titlebar header sizes itself from `env(titlebar-area-*)` CSS instead of hardcoded pixel values.

**Reason:** These are shell-level concerns, so they belong in shared hooks/components and narrow channels rather than duplicated inside fifteen tool files — same modularity rule as ADR-025. The prefs-backed folder memory removes the single most repeated click in export flows while leaving the WriteScopeGuard approval model untouched (the folder is still chosen through the native dialog every time). Reveal goes through IPC because sandboxed renderers have no `shell` access, and resolving paths main-side keeps renderer input untrusted per ADR-019. Zoom must resize the native overlay in lockstep with `setZoomFactor` or the window controls visually detach from the titlebar at non-default zoom; deriving overlay height from one clamped helper (unit tested) makes main-side creation, live changes and the renderer's env()-based fallback agree by construction.

## ADR-027 - Wave A quick utilities: sql-formatter + cron-parser, curated reference data, no IPC

**Decision:** Wave A adds six instant text/reference tools as renderer-side pure-logic modules with colocated vitest suites and lazy views (catalog: 39). `sql-formatter` wraps the new `sql-formatter` dependency behind a `{ok,output}|{ok:false,error:{message}}` result shape, stripping the library's raw token dump from user-facing parse errors. `cron-explainer` uses the new `cron-parser` v5 (`CronExpressionParser.parse`) for validation and next-five runs, but ONLY after an explicit five-field count check because v5 silently accepts 4/6-field expressions while this tool targets the standard 5-field grammar; friendly schedule descriptions are derived from the RAW fields (not parser internals) so they stay deterministic and testable, with a field-by-field fallback for exotic expressions. `html-entities` encodes/decodes as a pure text transform (named entities for the five markup characters plus ~40 common non-ASCII; numeric fallback; unknown named entities pass through untouched; control-character numerics rejected) - markup is never parsed or executed. `text-cases` keeps one tokenizer (`toWords`) as the single source of truth for both conversions and counters so camel/Pascal/snake/kebab/acronym boundaries (`XMLHttpRequest`, digit attachment) behave identically everywhere. `mime-lookup` ships its own curated ~65-entry table instead of exporting the private runtime map in shared/utils/files.ts (different audiences: reference completeness vs conservative runtime guessing) with forward/reverse/substring lookups. `http-status` carries the complete 63-code 1xx-5xx list with plain-language meanings and class chips. All six are static or stateless transforms: no IPC, no history records, no file capabilities.

**Reason:** Two new dependencies only where hand-implementing would be error-prone (SQL dialect formatting, cron iteration across DST/month lengths) follows principle 12; everything else is small enough that tested local code beats more dependencies. Deriving cron descriptions from raw fields avoids coupling UI copy to library internals that may change shape between major versions. The five-field pre-check exists because silently accepting 6-field (seconds-included) expressions would mislead users who pasted Quartz-style strings. Reference tools stay history-free by design - copying "404 Not Found" is not an activity worth persisting.

## ADR-028 - Batch Rename: shared pure naming engine, double write-scope validation, per-entry skip model

**Decision:** Wave B adds `batch-rename` (catalog: 40) as a folder-based tool. The rename rules live in a pure module (`shared/utils/rename-rules.ts`) imported by BOTH the renderer (live preview) and available to main, so the exact transformation the user previews is what gets applied - the renderer computes `[{from,to}]` pairs and main executes them rather than re-deriving names from rules. Transform order is fixed (find/replace -> case -> prefix/suffix -> numbering -> extension), transformations operate on the base name only (extension untouched unless `changeExt.to` is set, optionally filtered by `changeExt.from`, dot-normalized and lower-cased), invalid regexes surface as an `{error}` variant from `buildRenamePlan()` instead of throwing mid-batch, and duplicate targets are detected case-insensitively across PLANNED rows and reported as conflicts that block Apply. The new channels are `fs:list-dir` (dirs-first sorted listing) and `files:batch-rename`. Security doubles up: the directory must be approved via the existing WriteScopeGuard (approved by `dialog:choose-directory` itself - verified in register.ts), AND every individual from/to path is re-resolved main-side and required to be inside THAT directory (`=== dir || startsWith(dir + sep)`) plus pass `writeScope.isAllowed`; violations throw VALIDATION before any rename executes. Per-entry failures (source missing, target exists, name unchanged, OS errors) become `skipped[]` reasons instead of aborting the batch; results return full absolute output paths so result rows can offer Show-in-Explorer. Apply is gated behind a two-step confirm ("Apply N renames?" with 3 s revert) since renames are destructive-ish and there is no undo.

**Reason:** Renames touch arbitrary user folders - the one operation where the renderer supplies both sides of a mutation - so trusting renderer paths without main-side containment would widen the write scope beyond the dialog-approval model (ADR-019). Re-validating every pair (not just the directory) closes traversal via `..` segments inside nominally-approved names. Computing pairs renderer-side keeps the preview honest at zero duplication cost (the engine is shared, unit tested once) while main stays authoritative on existence/collision checks that can change between preview and apply (TOCTOU handled by re-stat + per-entry catch). Skipping instead of aborting matches the established batch semantics of image/media/pdf tools, and structured skip reasons keep partial failures actionable.

## ADR-029 - Wave E: renderer-side QR decode via injected canvas construction; embedded diceware wordlist with rejection-sampled CSPRNG

**Decision:** Wave E adds `qr-decoder` (catalog: 46) and `passphrase-generator` (catalog: 47). QR decoding stays entirely in the renderer: readFileBytes → Blob → createImageBitmap → 2D canvas → getImageData → jsQR, with OffscreenCanvas preferred and a document canvas as feature-detected fallback. Canvas construction is exposed through `pickDecoderCanvas(size, offscreenCtor, fallbackCtor, getContext2D)` so the surface choice is injectable and unit-testable without a DOM; oversized images are scaled by a pure `downscaleIfNeeded` (maxDim 2000) to bound pixel work; decode misses normalize through `extractResult` so "no QR found" is a guidance state, not an error. A decoded URL is never auto-opened — it is presented as copyable text with an explicit hint that Stash does not launch browsers. The passphrase tool embeds exactly 256 short English words (one full 8-bit index) and draws all randomness from crypto.getRandomValues using rejection sampling (no modulo bias); passwords guarantee at least one char per selected class before a CSPRNG Fisher–Yates shuffle. Entropy display is computed from the actual draw space (n·log2 256 for words, length·log2 alphabetSize for chars) with labeled strength bands, never color-only. The passphrase tool deliberately records nothing to history.

**Reason:** jsQR is a small pure-JS decoder that runs comfortably inside the 64 MiB readFileBytes cap, so routing the decode through main-process IPC would add a process hop without any capability win — matching the precedent set by pdf-to-text's renderer-side pdf.js (ADR-024-era decision). Injecting constructors keeps the environment-specific choice (OffscreenCanvas vs DOM canvas) testable and swappable while the pipeline stays honest about what it did. For secrets, the security-relevant properties are uniform sampling and never persisting output: rejection sampling removes modulo bias that would quietly shrink entropy, the embedded list makes the keyspace auditable (256 = log2 exact), and skipping history keeps high-frequency secret generation out of SQLite where it could outlive its usefulness.

## ADR-030 — Milestone 9: Renderer-driven batch queue chaining, Recharts usage insights, and profile portability

**Decision:** Milestone 9 implements automation chaining and usage analytics while adhering to local-first desktop principles. (1) Batch Queue execution is orchestrated in the renderer over existing tool IPC bridges (`window.stash.processing.*`, `window.stash.files.*`) rather than requiring custom main-process queuing infrastructure. Capability chaining is verified by a pure graph validation helper (`src/shared/utils/queue-validation.ts`) asserting producer outputs match consumer inputs before execution. Named presets are persisted in SQLite-backed preferences (`queue.presets`) via Zustand (`src/renderer/stores/queue.ts`). (2) The Usage Dashboard (`src/renderer/features/shell/UsageDashboard.tsx`) provides zero-latency visual summaries (volume, durations, top tools, category breakdowns, and activity timeline) by directly querying local SQLite history without external analytics or network calls. (3) Full profile and preset portability is provided via `.stash-profile` JSON export and import in Settings, bundling preferences, themes, queue presets, prompt libraries, and favorites using existing typed dialog and file system channels.

**Reason:** Reusing existing tool IPC channels avoids redundant backend state machines, preserves fine-grained progress reporting via `ProgressBus`, and guarantees tool execution logic remains identical whether run standalone or chained. Zero-cloud usage dashboards maintain strict privacy (principle 1) while giving users visibility into tool utility. Standalone profile export enables straightforward backup and migration across machines without account infrastructure (principle 2).

## ADR-031 — Tool #51: Offline Tesseract OCR Extractor with Sharp preprocessing

**Decision:** Tool #51 adds `image-ocr` as an offline image-to-text extraction tool. (1) Recognition runs in the main process (`src/main/processing/ocr.ts`) via Node worker threads using `tesseract.js`. Offline language traineddata (`eng.traineddata.gz`) is bundled in `resources/tessdata/` and packaged via `extraResources` in `electron-builder.yml`, completely bypassing CDN/network requests. (2) Automatic image preprocessing (grayscale, contrast normalization, binarization) is performed using native `sharp` before passing buffers to Tesseract, significantly improving accuracy on low-contrast scans, photos, and receipts. (3) Progress events (0–100%) and cooperative cancellation are piped through `ProgressBus` over `IPC.imagesOcr`. (4) The renderer (`ImageOcrTool.tsx`) provides layout segmentation mode selection (PSM), formatted text viewing, word/character statistics, confidence score classification, 1-click clipboard copy, and `.txt` file export.

**Reason:** Running Tesseract in the Node main process avoids browser Web Worker CSP and `file://` blob URL restrictions in packaged Electron applications while keeping heavy recognition off the UI thread. Bundling `eng.traineddata.gz` guarantees 100% offline usability (principle 1 & 3). Sharp preprocessing improves OCR accuracy on real-world photos without adding heavy external dependencies.

## ADR-032 — Tool #52: In-Memory Archive Inspector with Password Decryption

**Decision:** Tool #52 adds `archive-inspect` as an in-memory archive inspector and previewer. (1) Archive traversal runs in the main process via `unzipper` with `JSZip` fallback (`src/main/processing/archive-inspector.ts`), parsing central directory headers and file metadata (uncompressed size, compressed size, timestamp, CRC32, and encryption flags) without extracting archive contents to disk. (2) On-demand single entry previewing streams file bytes directly into in-memory `Uint8Array` buffers, allowing the renderer (`ArchiveInspectTool.tsx`) to generate ephemeral `Blob` URLs for live video, audio, image, PDF, and text/code inspection. All object URLs are revoked upon selection change or unmount to guarantee zero disk persistence and immediate RAM garbage collection. (3) Password-protected archives (Standard ZipCrypto and AES-256) are decrypted strictly in memory upon user prompt without persisting the password to disk or audit history logs. (4) Single-file extraction is supported directly to a user-chosen target path with strict zip-slip path validation (`isUnsafeEntryName`).

**Reason:** Users frequently inspect archives containing sensitive or private files (photos, code, videos, receipts) where extracting and deleting temporary files on disk creates security and data-leak risks. In-memory streaming satisfies principle 1 (local-first & secure) and principle 8 (premium desktop workstation craft) by providing instant zero-disk previews. Memory-only password handling ensures credentials and decrypted contents leave no trace on disk.

## ADR-033 — Local File Reference Gallery & Asset Stash (Design Plan)

**Decision:** The asset gallery / recent uploads shelf will store lightweight file path references and metadata in local SQLite, pointing directly to the original file paths on the user's PC without copying or duplicating file contents on disk.

**Reason:** Preserves local-first principles and disk space efficiency: no redundant file bloat, zero cloud storage, instant access, and seamless cross-tool reuse (e.g. dragging or selecting a referenced local file directly into any Stash tool).

## ADR-034 — Hermanos Desktop App Starter Template & UI/UX Design System Extraction (Future Planned Milestone)

**Decision:** Hermanos Stash's signature UI/UX design language and local-first Electron engine will serve as the official boilerplate starter template for all future Hermanos desktop applications. Implementation is intentionally scheduled as a planned final milestone (Milestone 11) after the Hermanos Stash application build is fully reviewed and approved.

**Reason:** The app's design system—including the iconic giant "HERMANOS" background watermark (`Wordmark.tsx`), dark workstation palette, typography hierarchy, collapsible shadcn-style navigation sidebar, command palette, unified dropzones, and hardened Electron IPC bridge—represents a reusable, cohesive, premium desktop aesthetic. Extracting it as a parameterized starter kit ensures upcoming applications can be launched with rapid setup, zero code duplication, and immediate brand continuity without interfering with Stash's ongoing engineering.

## ADR-035 — Dual-Tool Split-Screen Workspace with Resizable Splitter and In-Pane Quick Switcher

**Decision:** Integrated a native side-by-side dual-tool workspace mode inside Hermanos Stash adhering strictly to Principle 5 ("One window: tools navigate within the application; do not spawn browser tabs/windows"). (1) State is managed through `src/renderer/stores/workspace.ts`: `splitMode` (boolean), `secondaryToolId` (string | null), `splitRatio` (number, persisted to local SQLite prefs under `ui.splitRatio`, clamped 0.25–0.75 with default 0.50), and `activePane` ('primary' | 'secondary'). (2) Accessible toggle triggers are provided across the UI: a dedicated titlebar button in the frameless header (`App.tsx`), a header action button in `ToolPage.tsx` next to Dock Pin and Star, and a global keyboard shortcut `Ctrl + \` / `Cmd + \`. (3) `DualToolWorkspace.tsx` provides a draggable resizer divider with visual grab handle, double-click reset to 50/50, and keyboard ArrowLeft/Right accessibility (`role="separator"`, `aria-valuenow`). (4) Each pane contains a compact titlebar with a tool icon, name, category badge, and quick actions: `ToolQuickPicker` modal dialog to switch tools in either pane with instant search and category filters, Swap Panes (`⇄`), Maximize/Focus Pane (`⤢`), and Close Split (`✕`). (5) `ToolPage.tsx` supports an `embedded?: boolean` prop that suppresses the large hero header in split mode and provides clean independent scrolling for both panes.

**Reason:** Power users frequently compare or cross-reference data across tools (e.g. text diff alongside JSON formatter, regex tester alongside prompt library, hash generator alongside base64 text, or markdown preview alongside image converters). Running two tools side-by-side within the single application shell provides desktop workstation productivity without window-juggling or multiple OS instances. The embedded mode saves vertical space while maintaining full tool functionality and isolated React state.

## ADR-036 — Tool #76: ID & Passport Photo Studio (`id-photo-maker`)

**Decision:** Tool #76 adds `id-photo-maker` as an automated portrait sizing, biometric framing, and print-sheet generator. (1) Standard ID sizing: exact physical dimension mapping for 1x1 inch (25.4mm / 72pt), 2x2 inch (50.8mm / 144pt), and 35x45mm passport ratios. (2) Interactive framing: zoom/pan sliders, biometric head & eye-line guides, optional background replacement (White, Off-White, Sky Blue, Red), and optional formal bottom white nametag banner (`SURNAME, FIRST NAME, M.I.`) required by Civil Service and government bodies. (3) Print package engine: automatically computes grid coordinates on Letter, A4, and 4x6" photo card paper for 8 pcs 1x1, 4 pcs 2x2, 6 pcs Passport, and Combo Packs (e.g. 2 pcs 2x2 + 8 pcs 1x1) with hairline scissor cutting guides. (4) Multi-format export: print-ready vector PDF via `pdf-lib` (100% exact real-world scale), Microsoft Word (`.docx`) OpenXML package via `jszip` with table cells in EMUs/DXA, high-res 300 DPI PNG, and direct browser printing via `window.print()`.

**Reason:** Users frequently need 1x1, 2x2, or passport photos for university, civil service, PRC, visa, and employment applications. The traditional manual method—pasting photos into Microsoft Word, eyeballing dimensions with a ruler, and dealing with page margin shifts—is frustrating and error-prone. This tool guarantees 100% physical print accuracy, provides zero-cloud privacy (local-first, Principle 1), and requires zero new external libraries (Principle 12).

## ADR-037 — Tool #77: Offline Token Counter & Cost Estimator (`token-counter`)

**Decision:** Tool #77 adds `token-counter` to the `future` (Experiments & AI-adjacent) category as an offline BPE tokenization, context window visualization, and LLM cost projection workstation. (1) Zero-network execution: Tokenization uses pure client-side regex segmentation matching official BPE cl100k/o200k pre-tokenizer patterns, subsegmenting compound words, multi-digit numbers, whitespace, and CJK characters without external APIs, WebAssembly, or network calls (Principle 1 & 3). (2) Multi-model estimation profiles: Provides exact and calibrated token counts and cost projections for OpenAI (GPT-4o, GPT-4o mini, GPT-3.5), Anthropic (Claude 3.5 Sonnet, Claude 3.5 Haiku), Meta (Llama 3.1), and Google (Gemini 1.5 Pro, Flash). (3) Interactive token visualizer: Displays segmented token chunks highlighted with 6-color rotating pastel tints with high WCAG contrast in dark mode, showing hover details (token index, character count, span offsets, and whitespace symbols). (4) Context window gauge: Visualizes percentage fill against model context limits (128k, 200k, 1M, 2M) with safe/warning/exceeded indicators and token headroom calculations. (5) Cost calculator: Calculates prompt input cost and user-projected completion token cost at official published per-million rates. (6) Universal input: Supports direct typing, pasting, sample presets, and file drag & drop (`.txt`, `.md`, `.json`, `.ts`, `.py`, `.csv`).

## ADR-038 — Tool #78: Local LLM Playground & Benchmark [BETA] (`local-llm-playground`)

**Decision:** Tool #78 adds `local-llm-playground` to the `future` (Experiments & AI-adjacent) category, officially tagged as `BETA`. (1) Direct local daemon integration: Connects via HTTP REST streams to localhost daemons—Ollama (`http://localhost:11434`), LM Studio / vLLM (`http://localhost:1234`), and custom endpoints. All inferences run directly on user hardware with zero external API calls or telemetry. (2) Real-time hardware performance telemetry: Live token speed gauge calculates generation speed (**tok/s**) directly from Ollama's official nanosecond metadata (`eval_count / eval_duration`) or high-precision client timestamps, alongside Time-to-First-Token (TTFT) and total duration. (3) Built-in offline simulation sandbox: Bundles simulated models (`llama-3.2-3b-sim`, `deepseek-r1-7b-sim`, `phi-4-14b-sim`) with synthetic token streaming so the workbench and speed telemetry can be benchmarked and evaluated offline without requiring active local daemon processes. (4) Beta status: The tool is explicitly configured with `isBeta: true` on its `ToolDefinition` (matching the platform standard used by `ascii-banner` and `svg-creator`) to render the canonical amber `BETA` badge across the UI and documentation, denoting that endpoint compatibility, model quantization handling, and extended streaming protocols are actively undergoing user testing and iterative refinement.

**Reason:** Local LLMs running on personal hardware are a cornerstone of local-first privacy and autonomous computing. AI developers and power users need a fast, zero-friction desktop client to benchmark generation speed across quantizations, compare model outputs, and test system prompts without spinning up heavyweight web browser frontends. Adding this tool directly inside Hermanos Stash satisfies Principle 1 (local-first) while honoring scope discipline by clearly delineating its active Beta evaluation status.

## ADR-039 — Queue Workflow View & Visual Pipeline Orchestrator

**Decision:** Transform the Queue Tools feature into a full-screen, interactive workflow canvas view (using visual node-graph workflow patterns inspired by n8n, MIT App Inventor, and Node-RED as design reference) for composing, connecting, executing, and saving multi-tool pipelines across all 78 local utilities.
1. **Bespoke Native SVG + React Canvas Engine:** Built directly using React and SVG without external canvas libraries (e.g. `@xyflow/react`) to eliminate React 19 peer-dependency conflicts and heavy bundle overhead. Employs GPU-accelerated CSS transforms (`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`), 60fps pointer dragging, grid snapping (20px), wheel/trackpad zooming (30% to 200%), and smooth cubic Bézier vector wires (`M x1 y1 C cx1 cy1, cx2 cy2, x2 y2`).
2. **Full-Screen Workstation Layout with Responsive Shell Integration:** On navigating to the Queue view, the main navigation sidebar automatically collapses (`sidebarCollapsed: true`) to maximize canvas acreage, with an explicit expand/collapse toggle (`PanelLeft` / `PanelLeftClose`) and global `Ctrl+B` shortcut. Outer scrollbars are suppressed (`overflow-hidden h-full flex flex-col`) for seamless native canvas interaction.
3. **Empty Canvas by Default:** The canvas starts cleanly with zero auto-inserted nodes, providing an intentional empty state with instant quick actions to open the tool palette or browse recipes.
4. **Smooth In/Out Animated Drawers & Modals:** Both the 78-Tool Palette drawer and the Browse Recipes drawer implement smooth slide-and-fade in/out animations with backdrop overlays for closing on outside click.
5. **Direct Node Input & Strict Validation:** Node cards provide direct interactive input controls: native OS file selection (`window.stash.dialogs.openFile`), drag-and-drop file attachment onto the card, and text payload input. When executing, the pipeline strictly validates that every tool requiring input either has attached files/text or is connected to an upstream output. Execution is strictly blocked with clear error guidance if inputs are missing, and no synthetic sample data is used.
6. **DAG Topological Execution Engine:** Validates the workflow graph for cycles, computes execution order via Kahn's algorithm, and orchestrates sequential/branching pipeline execution passing real intermediate file artifacts and text payloads between tools with live visual node state indicators (`idle`, `running`, `success`, `error`) and animated cable flow pulses (`wireDash` keyframes).
7. **Workflow Templates & Preset System:** Users can save custom workflows directly to local SQLite storage (`workflow.userTemplates`), load curated workstation recipes (Photo ID Studio, Media Transcoder, Document Security, API Payload Validator), and import/export `.stashflow.json` workflow files for easy sharing and backup.
8. **Bidirectional Linear Interoperability:** Maintains 100% backward compatibility with linear queue presets via `stepsToWorkflowGraph` and `workflowGraphToSteps`, allowing users to switch between the Workflow Canvas and Linear Queue views without loss of state.

**Reason:** Power users need an intuitive, visual mental model to orchestrate complex multi-step data pipelines—such as compressing images, converting them to PDF, stamping watermarks, and calculating file hashes—without manually managing intermediate files or remembering step order. A visual node graph with drag-and-drop wiring makes the data flow tangible, eliminates manual friction, and elevates Hermanos Stash to a professional-grade desktop utility workstation while adhering strictly to local-first principles and design system consistency.
 
## ADR-040 — Independent Feature Semantic Versioning for Queue Workflow View [BETA]
 
**Decision:** Establish an independent semantic versioning track (`QUEUE_WORKFLOW_VERSION` in `src/renderer/features/workflow/version.ts`, starting at `0.1.0`) strictly and exclusively for the Queue Workflow feature, completely decoupled from the core desktop application (`package.json`).
1. **Strict Feature Exclusivity:** Governs only files under `src/renderer/features/workflow/` and queue workflow view integrations. It does NOT affect or apply to any other tools or the overall application version.
2. **Incrementation Protocol (Workflow Only):**
   - **PATCH (`0.1.x` → `0.1.x+1`)**: Any bug fix, UI/UX refinement, visual adjustment, or non-breaking patch within the workflow view.
   - **MINOR (`0.x.0` → `0.x+1.0`)**: Any additive feature, new workflow node type, recipe preset, or export capability.
   - **MAJOR (`x.0.0` → `x+1.0.0`)**: Any breaking change to the `.stashflow.json` schema or graduation out of BETA.
3. **UI Transparency:** The active version is displayed alongside the amber `BETA` pill in the workflow toolbar and queue headers during the testing phase.
4. **Temporary Testing Lifecycle & Planned Retirement:** This versioning track is an interim harness while the feature undergoes active iteration and user testing. Once all capabilities are fully tested and stabilized, this feature version tag and rule will be cleanly retired and removed.
 
**Reason:** The Visual Workflow View is a major capability leap involving complex graphical state management, DAG topological execution, drag-and-drop routing, and template serialization. Iterating on UI/UX fixes and bug fixes happens at high frequency. Tracking an independent feature version provides fine-grained provenance without falsely bumping the version of the entire 78-tool desktop suite.

## ADR-041 — Node Detailed View & Inspector Architecture (n8n-style) with Planned Incompatible Wiring Validation

**Decision:**
1. **Node Inspector & Parameters Drawer (`WorkflowNodeDetailDrawer.tsx`):**
   - Provide an in-depth slide-over inspector for workflow nodes without full-screen backdrops, preserving canvas visibility.
   - Support inline node title renaming with instant synchronization to canvas cards.
   - Expose rich dynamic parameter configurations tailored to tool category (e.g. image compression quality & formats; PDF page ranges & watermarks; text case formatting & indentation).
   - Direct file and text payload manager with drag-and-drop dropzone, file list with individual removals, and multi-line payload editors.
   - Comprehensive wiring topology overview showing upstream source nodes and downstream target nodes with 1-click disconnect actions.
   - Isolated single-step test runner (`executeStep`) executing only the targeted node with live execution timing, output files preview, and output text previews.
2. **Multiple Ergonomic Interaction Triggers:**
   - Double-clicking any node on the canvas.
   - Dedicated `Settings2` configure button in the node header actions.
   - Right-click context menu ("Configure & Details", "Duplicate Node", "Delete Node").
   - Keyboard shortcut: `Enter` on a selected node opens inspector; `Ctrl+D` duplicates; `Escape` closes context menu / inspector.
3. **Upcoming Planned Candidate — Incompatible Wire Connection Validation:**
   - Tools can still be freely dropped anywhere on the canvas regardless of category.
   - When dragging cables, connections between incompatible port types (e.g. text output into file-only input, or tools lacking input/output capabilities) will be intercepted, rejected, and highlighted with immediate user guidance toasts.

**Reason:** Enables fine-grained per-step customization and parameter tuning akin to leading automation platforms (n8n, Node-RED) while maintaining a clutter-free canvas and zero-latency local execution.







