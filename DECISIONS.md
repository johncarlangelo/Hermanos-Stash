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
