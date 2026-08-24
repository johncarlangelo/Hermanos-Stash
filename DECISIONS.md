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
