# Hermanos Stash

**A local-first desktop toolbox.** One window, 33 focused tools for files, documents, images, video, audio, text and developer work — everything processed on your machine, nothing sent anywhere.

```text
┌──────────────────────────────────────────────────────────────┐
│  STASH · breadcrumb                               □  ✕  win │
├──────────────┬───────────────────────────────────────────────┤
│  Home        │                                               │
│  History     │   Tool workspace — drop a file, set options,  │
│              │   get the result.                             │
│  Favorites   │                                               │
│  Recent      │   Ctrl K opens the command palette from       │
│  Categories  │   anywhere.                                   │
│              │                                               │
│  Settings    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

---

## Why Stash

Small file problems come up constantly: *split this PDF*, *shrink these images*, *extract the audio*, *format that JSON*. The usual answer is a different sketchy web page for each one.

Stash is the opposite bet: **one installed app you can trust**, where every byte stays on your disk. No accounts. No cloud. No telemetry. No paid APIs. It works fully offline.

## Highlights

- **33 tools, one catalog** — searchable with fuzzy matching (`Ctrl+K`), organized by category and tags.
- **Drop-anywhere routing** — drag a file onto any empty part of the window and Stash suggests the tools that handle it.
- **Real progress + cancellation** — batch operations run outside the UI with live ratios; cancel any time.
- **Activity history** — every operation is recorded locally (tool, file names, outcome, duration). File *contents* are never stored.
- **Your preferences stick** — output folders, file names, formats, quality levels and zoom are remembered per tool.
- **Honest states everywhere** — loading, error, partial success and empty states explain what happened and what to do next.

## The tool catalog

### Text & Data

| Tool | What it does |
|---|---|
| JSON Formatter | Pretty-print, minify and validate JSON with precise line/column errors |
| Base64 Encoder / Decoder | UTF-8-safe text ⇄ Base64 |
| Markdown Preview | Live sanitized HTML preview (GFM) |
| YAML ⇄ JSON | Two-way conversion with source-mapped errors |
| CSV ⇄ JSON | Strict RFC 4180 parser, delimiter control, header-row toggle |
| Text Diff | Line-by-line LCS diff with add/remove highlighting |

### Files & Archives

| Tool | What it does |
|---|---|
| File Metadata Viewer | Size, dates, MIME type, full path — multi-file |
| ZIP Creator | Pack any mix of files into one archive |
| ZIP Extractor | Extract archives with zip-slip protection |

### Images

| Tool | What it does |
|---|---|
| Image Preview | Inspect dimensions/size with fit + zoom controls |
| Image Converter | Batch-convert PNG / JPEG / WebP / AVIF / TIFF |
| Image Compressor | Batch-compress with optional downscaling, shows bytes saved |
| EXIF Inspector | Camera, lens, exposure, date and GPS metadata |

### Documents & PDF

| Tool | What it does |
|---|---|
| PDF Preview | Fast canvas rendering, page navigation, keyboard paging |
| PDF Merger | Combine PDFs in an order you control |
| PDF Splitter | Extract ranges like `1-3, 7` into separate documents |
| PDF Rotator | Rotate all or selected pages by 90° / 180° / 270° |
| PDF Page Reorderer | Arrange pages into any explicit sequence |
| PDF Optimizer | Lossless structural rewrite to shrink size safely |
| Images → PDF | One natural-size page per JPG/PNG |
| PDF → Images | Render every page to PNG/JPEG, packed into a ZIP |

### Video & Audio *(FFmpeg-powered)*

| Tool | What it does |
|---|---|
| Video Converter | MP4 / WebM / MKV with CRF quality control |
| Video Compressor | Quality presets plus resolution capping |
| Video → GIF | Two-pass palette-optimized GIFs |
| Audio Extractor | Pull soundtracks out of video as AAC / MP3 / WAV / FLAC / Opus |
| Audio Converter | Convert between the same codecs |

Every media output is re-probed after processing — container type and duration must check out before the result is handed to you.

### Developer

| Tool | What it does |
|---|---|
| Regex Tester | Live matches with groups, flags and highlight preview |
| JWT Decoder | Decode header/payload with expiry status (signatures deliberately *not* verified) |
| Unix Timestamp Converter | Seconds/milliseconds ⇄ human time, both directions |
| Hash Generator | MD5 / SHA-1 / SHA-256 / SHA-512 of text or any file (streamed) |
| UUID Generator | Bulk v4 UUIDs from the OS secure random source |
| URL Utilities | Parse components, inspect query params, encode/decode |
| QR Code Generator | Scannable codes with copy-image and save-to-PNG |

---

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) ≥ 22 and npm.

```bash
git clone https://github.com/johncarlangelo/Hermanos-Stash.git
cd "Hermanos Stash"
npm install
npm run dev
```

### FFmpeg (optional, unlocks video/audio tools)

Stash spawns FFmpeg directly — no bundled download, no native module builds. Provide binaries either way:

1. **Project-local (preferred):** place `ffmpeg.exe` and `ffprobe.exe` in `resources/ffmpeg/`
2. **System PATH:** if `ffmpeg` resolves globally, that works too

Video/audio tools detect this automatically and show clear guidance if neither is present. Everything else works without FFmpeg.

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR for main, preload and renderer |
| `npm run build` | Production build (`out/`) |
| `npm run typecheck` | Strict TypeScript across all processes |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier |
| `npm test` | Vitest suite |
| `node scripts/e2e-probe.mjs` | CDP desktop probe: drives the real UI (favorites, navigation, settings) |
| `node scripts/e2e-drag-probe.mjs` | CDP drag probe: synthesizes a real OS-backed file drop |
| `npm run package` | Build + produce `release/win-unpacked/` (FFmpeg bundled via extraResources) |
| `npm run dist` | NSIS installer |

> Windows-first today: packaging targets and titlebar integration assume Windows, while the codebase keeps platform branches where practical.

## How it's built

```text
Electron 43 ─ React 19 ─ TypeScript ─ Vite 7 ─ Tailwind CSS v4 ─ Zustand

Renderer (sandboxed, no Node)
   │  typed bridge only — window.stash
Preload (contextBridge)
   │  narrow validated IPC channels
Main process
   ├── SQLite via node:sqlite  (prefs · favorites · recents · history)
   ├── Temporary workspace manager  (stale purge + quit cleanup)
   ├── ProgressBus  (live events + cooperative cancellation)
   ├── Write-scope guard  (writes limited to dialog-approved paths)
   └── Processing services  (sharp · jszip · pdf-lib · FFmpeg spawn)
```

Key architectural choices:

- **Sandboxed renderer, zero Node access.** The renderer sees exactly one typed API surface (`src/shared/ipc.ts`). Every channel validates its inputs; every thrown value crosses the boundary as a structured, user-safe error.
- **Narrow write scope.** Reads are broad (you can inspect any local file), but writes are restricted to paths you approved through a native dialog or the temp workspace.
- **Registry-driven shell.** Tools register a definition + lazy view in one file; the shell never imports tool internals. Adding tool #34 touches nothing else.
- **SQLite without native builds.** Persistence uses Node's built-in `node:sqlite` engine (WAL mode) — real SQL with zero ABI headaches.
- **Mature libraries for hard formats:** sharp, jszip, pdf-lib, pdf.js, marked + DOMPurify, js-yaml, exifr, qrcode. Hand-written parsers exist only where they're small enough to own (CSV, diffs, page-range grammar).

## Verification culture

This project treats verification as part of correctness:

- **352 unit/integration tests** — including tests that generate real PDFs, images and videos at runtime and assert on actual outputs.
- **Two CDP harnesses** launch the production build and drive the *real* DOM — clicking favorites, navigating to Settings, dragging actual files — asserting behavior, not just "it boots".
- A headless smoke mode (`--smoke-test`) proves services initialize inside Electron's main process.
- Per-tool checklist evidence lives in [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## Documentation

| Doc | Contents |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements and scope |
| [`DESIGN.md`](DESIGN.md) | Visual direction, accessibility bar |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Process boundaries, lifecycle, extensibility |
| [`TOOL_SPEC.md`](TOOL_SPEC.md) | The contract every tool follows |
| [`AGENTS.md`](AGENTS.md) | Operating contract for autonomous development |
| [`LOOP.md`](LOOP.md) | Plan → implement → verify → review loop |
| [`VERIFY.md`](VERIFY.md) | Verification protocol |
| [`TASKS.md`](TASKS.md) | Task board |
| [`PROGRESS.md`](PROGRESS.md) | Current state and evidence |
| [`DECISIONS.md`](DECISIONS.md) | Architecture decision records |
| [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md) | Per-tool verification evidence |

## Status

All planned milestones are complete and engineering-verified. The roadmap now grows by usage: more tools slot into the existing registry without touching the core. See [`TASKS.md`](TASKS.md) for what's next.

## License

MIT
