# Hermanos Stash — Tool Architecture Specification

## Purpose

This document defines how tools are added so Stash can grow sustainably as a cohesive desktop workstation without becoming a monolith.

## Tool identity

Every tool requires:

- `id`: stable machine identifier (e.g. `pdf-merge`, `image-convert`, `image-ocr`)
- `name`: user-facing tool title (e.g. `Image OCR Extractor`)
- `category`: standard category ID (`files` | `documents` | `images` | `video` | `audio` | `text` | `developer` | `future`)
- `description`: concise explanation of tool function
- `tags`: array of searchable keywords for discovery in `Ctrl+K` command palette
- `icon`: Lucide icon name matching registered icons in `src/renderer/components/icons.ts`
- `version`: semantic version string (e.g. `1.0.0`)

IDs must remain stable after release because they are used in favorites, recents, queue presets, and activity history.

## Capability model

A tool declares its capabilities in `ToolDefinition.capabilities`:

- `acceptsFiles`: accepts single file inputs
- `acceptsMultipleFiles`: accepts multi-file batch drops
- `acceptsText`: accepts raw string input / clipboard text
- `producesFiles`: outputs one or more files to disk
- `producesText`: produces textual output
- `supportsProgress`: streams 0..1 ratio progress events over `ProgressBus`
- `supportsCancellation`: supports cooperative cancellation tokens
- `supportsBatch`: can process collections of items in parallel/sequence

Capabilities are verified automatically by the Batch Queue Runner (`src/shared/utils/queue-validation.ts`) to validate pipeline compatibility.

## Tool lifecycle

```text
DISCOVER (Search / Sidebar / Queue)
   ↓
INPUT (DropZone / Textarea / File Picker)
   ↓
VALIDATE (Extensions, formats, parameter ranges)
   ↓
PROCESS (Main process worker / Sharp / FFmpeg / PDF.js / pure logic)
   ↓
VERIFY RESULT (Output file existence, status check)
   ↓
PRESENT RESULT (Stats, preview, actions: Copy, Open, Save As)
   ↓
HISTORY (recordHistoryQuietly to SQLite audit log)
```

## Standard states

Every tool implementation must gracefully handle:

- **idle**: default empty/ready state with clear contextual hints
- **dragOver**: responsive border and visual cues on file drag
- **validating**: checking file format, byte size, or input schema
- **processing**: active spinner with streamed progress ratio (0..1) and status message
- **success**: crisp presentation of outputs, byte metrics, and next-step actions
- **partialSuccess**: batch summaries indicating succeeded vs skipped/failed files
- **cancelled**: clean resource cleanup without orphaned temp files
- **error**: structured `StashError` banner with actionable recovery guidance

## Errors

Errors crossing IPC boundaries must be normalized into `StashError` (`src/shared/errors.ts`):

```ts
interface StashError {
  code: ErrorCode // UNKNOWN | VALIDATION | FS_READ | FS_WRITE | CANCELLED | ...
  userMessage: string
  technicalMessage?: string
  recoverable: boolean
}
```

Never expose raw uncaught exceptions or stack traces to the user.

## Results

Tool output presentations should include:
- output file path or preview;
- formatted file sizes (`formatBytes`);
- duration or speed where applicable;
- 1-click clipboard copy or native save dialog;
- clear warning/skip notices for partial batch operations.

## History integration

Record tool execution asynchronously via `recordHistoryQuietly`:
```ts
recordHistoryQuietly({
  toolId: 'image-ocr',
  operation: 'Extract Text',
  inputs: [file.name],
  outputs: [],
  durationMs,
  status: 'success'
})
```

History failures must never break or block the user's workflow.

## UI contract

Tools must compose shared design system components from `src/renderer/components/ui/`:
- `DropZone`: drag-and-drop file target with extension filtering
- `Button`, `IconButton`: primary, secondary, and icon action triggers
- `Panel`, `SectionHeading`, `EmptyState`, `ErrorNote`, `Spinner`: consistent elevation and feedback
- `FieldRow`, `Select`, `Toggle`, `ClearableTagInput`: standardized dark inputs

## Adding a tool checklist

Every time a new tool is added:

- [ ] **1. Define stable ID & Metadata**: declare category, tags, Lucide icon, and capabilities in `src/renderer/tools/index.ts`.
- [ ] **2. Implement Processing / IPC**: create main process worker in `src/main/processing/` (if native/heavy) and register IPC channels in `src/shared/ipc.ts`, `src/main/ipc/register.ts`, and `src/preload/index.ts`.
- [ ] **3. Pure Logic & Tests**: place pure calculation/formatting helpers and unit tests in `src/renderer/tools/<tool-id>/logic.ts` and `logic.test.ts`.
- [ ] **4. Build UI Component**: create `<ToolName>Tool.tsx` using design system components and dark palette.
- [ ] **5. Register View Component**: add lazy import in `TOOL_COMPONENTS` (`src/renderer/tools/index.ts`).
- [ ] **6. Run Verification Gates**:
  - `npm run typecheck`
  - `npm run test`
  - `npm run lint`
  - `npm run format:check`
  - `npm run build`
- [ ] **7. Update Project Documentation**:
  - Update `TOOL_CATALOG.md` (mark as shipped under category).
  - Update `TOOL_SPEC.md` (if architecture or contracts evolved).
  - Update `PROGRESS.md` (increment tool count and summarize implementation).
  - Update `TASKS.md` (mark task items as complete).
  - Document key architecture choices in `DECISIONS.md`.
- [ ] **8. Commit & Push**: commit with Conventional Commits (`feat(tools): add <name> tool`) and push to `origin/main`.
