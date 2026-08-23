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
