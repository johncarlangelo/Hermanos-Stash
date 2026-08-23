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
