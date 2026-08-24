<div align="center">

# HERMANOS STASH

**One window. Fifty tools. Zero cloud.**

A local-first desktop toolbox for files, documents, images, video, audio,
text, developer work and reusable AI prompts — everything processed on your
machine, nothing sent anywhere.

![Tools](https://img.shields.io/badge/tools-50-d9a35c)
![Tests](https://img.shields.io/badge/tests-553_passing-85bb90)
![License](https://img.shields.io/badge/license-MIT-9aa2b1)
![Electron](https://img.shields.io/badge/Electron-43-2b2f3a)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3b82f6)
![Offline](https://img.shields.io/badge/cloud-none-important)

</div>

---

> Small file problems come up constantly — *split this PDF*, *shrink these
> images*, *extract the audio*, *format that JSON*. The usual answer is a
> different sketchy web page for each one.
>
> **Stash is the opposite bet:** one installed app you can trust, where every
> byte stays on your disk. No accounts. No telemetry. No paid APIs. Fully
> offline.

---

## The experience

```text
┌──────────────────────────────────────────────────────────────┐
│  STASH · breadcrumb                               □  ✕  win │
├──────────────┬───────────────────────────────────────────────┤
│  Home        │                                               │
│  History     │   Drop a file anywhere. Set your options.     │
│              │   Get the result.                             │
│  Favorites   │                                               │
│  Recent      │   Ctrl K opens the command palette from       │
│  Categories  │   anywhere — fuzzy search across every tool.  │
│              │                                               │
│  Settings    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

| It remembers | It protects | It respects |
|---|---|---|
| Output folders, file names, formats and quality levels per tool | Sandboxed renderer · validated IPC · write-scope guard · CSP | Your attention: honest empty states, keyboard-first flow, restrained motion |
| Your activity history (names only, never contents) | Zip-slip guards · encrypted-PDF detection · traversal checks | Reduced-motion preferences · WCAG-conscious contrast |

**Drop-anywhere routing** — drag a file onto any empty part of the window and
Stash suggests every registered tool that handles it.

## Quick start

```bash
git clone https://github.com/johncarlangelo/Hermanos-Stash.git
cd "Hermanos Stash"
npm install
npm run dev          # launches the app with hot reload
```

**FFmpeg (optional):** place `ffmpeg.exe` + `ffprobe.exe` in `resources/ffmpeg/`
(or have them on PATH) to unlock the video and audio tools. Everything else
works without them.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl K` | Command palette — fuzzy-search all 50 tools |
| `Esc` | Back to workspace |
| `Ctrl 1–5` | Open your first five favorites |
| Drag file → window background | Find matching tools |

## The catalog — 50 tools

<details>
<summary><strong>Text & Data</strong> — 8 tools</summary>

| Tool | What it does |
|---|---|
| JSON Formatter | Pretty-print, minify, validate — precise line/column errors |
| Base64 Encoder / Decoder | UTF-8-safe text ⇄ Base64 |
| Markdown Preview | Live sanitized HTML preview (GFM) |
| YAML ⇄ JSON | Two-way conversion with source-mapped errors |
| CSV ⇄ JSON | Strict RFC 4180 parser, delimiter control, header-row toggle |
| Text Diff | Line-by-line LCS diff with add/remove highlighting |
| Case Converter & Counter | camel / snake / kebab / title + word & reading-time stats |
| HTML Entities & Slug | Encode/decode entities, generate clean URL slugs |

</details>

<details>
<summary><strong>Files & Archives</strong> — 4 tools</summary>

| Tool | What it does |
|---|---|
| File Metadata Viewer | Size, dates, MIME type, full path — multi-file |
| ZIP Creator | Pack any mix of files into one archive |
| ZIP Extractor | Extract archives with zip-slip protection |
| Batch Rename | Pattern-based bulk renaming with dry-run preview |

</details>

<details>
<summary><strong>Images</strong> — 6 tools</summary>

| Tool | What it does |
|---|---|
| Image Preview | Dimensions, size, fit + zoom controls |
| Image Converter | Batch PNG / JPEG / WebP / AVIF / TIFF |
| Image Compressor | Batch compression with downscaling, shows bytes saved |
| EXIF Inspector | Camera, lens, exposure, date, GPS metadata |
| Image Watermarker | Batch text stamps with position and opacity control |
| Social Preset Resizer | og:image, X card, Instagram, YouTube — smart crop |

</details>

<details>
<summary><strong>Documents & PDF</strong> — 9 tools</summary>

| Tool | What it does |
|---|---|
| PDF Preview | Canvas rendering, page navigation, keyboard paging |
| PDF Merger | Combine documents in an order you control |
| PDF Splitter | Extract ranges like `1-3, 7` into separate files |
| PDF Rotator | Rotate all or selected pages by 90° / 180° / 270° |
| PDF Page Reorderer | Arrange pages into any explicit sequence |
| PDF Optimizer | Lossless structural rewrite to shrink size safely |
| Images → PDF | One natural-size page per JPG/PNG |
| PDF → Images | Every page rendered to PNG/JPEG, packed into a ZIP |
| PDF → Text | Extract searchable text, save as `.txt` |

</details>

<details>
<summary><strong>Video & Audio</strong> — 5 tools · FFmpeg-powered</summary>

Every output is re-probed after processing — container type and duration must
check out before the result reaches you.

| Tool | What it does |
|---|---|
| Video Converter | MP4 / WebM / MKV with CRF quality control |
| Video Compressor | Quality presets plus resolution capping |
| Video → GIF | Two-pass palette-optimized GIFs |
| Audio Extractor | Pull soundtracks as AAC / MP3 / WAV / FLAC / Opus |
| Audio Converter | Convert between the same codecs |

</details>

<details>
<summary><strong>Developer</strong> — 16 tools</summary>

| Tool | What it does |
|---|---|
| Regex Tester | Live matches with groups, flags and highlight preview |
| JWT Decoder | Header/payload with expiry status (signatures deliberately not verified) |
| Unix Timestamp Converter | Seconds/milliseconds ⇄ human time, both directions |
| Hash Generator | MD5 / SHA-1 / SHA-256 / SHA-512 of text or any file, streamed |
| UUID Generator | Bulk v4 UUIDs from the OS secure random source |
| Passphrase Generator | Diceware words or characters, entropy-metered |
| URL Utilities | Parse components, inspect query params, encode/decode |
| SQL Formatter | Pretty-print SQL across dialects with keyword casing |
| Cron Explainer | Plain-language schedules with next-run preview |
| MIME Lookup | Searchable extension-to-type reference |
| HTTP Status Reference | Every status code explained |
| Color Converter | HEX/RGB/HSL, WCAG contrast, shade & harmony palettes |
| Icon Pack Generator | One logo → sizes 16–512 plus `favicon.ico` |
| JSON → TypeScript | Paste JSON, get clean interface definitions |
| QR Decoder | Drop an image, read the code |
| QR Code Generator | Scannable codes, copy-image or save-to-PNG |

</details>

<details open>
<summary><strong>Prompt Library & Brand Studio</strong> — 2 tools · local, no AI API</summary>

| Tool | What it does |
|---|---|
| Prompt Library | Reusable prompts with `{{variables}}` you fill before copying — search, tags, starter pack, JSON import/export |
| Brand Bible Creator | Compose a brand guide: colors with auto palettes and contrast, type scale, voice, usage rules — export as Markdown/JSON |

</details>

## Under the hood

```text
Electron 43 ─ React 19 ─ TypeScript ─ Vite 7 ─ Tailwind CSS v4 ─ Zustand

Renderer (sandboxed, zero Node access)
   │  one typed bridge — window.stash
Preload (contextBridge)
   │  narrow, validated IPC channels
Main process
   ├── SQLite via node:sqlite      prefs · favorites · recents · history · prompts
   ├── Temp workspace manager      stale purge on start · wiped on quit
   ├── ProgressBus                 live events + cooperative cancellation
   ├── Write-scope guard           writes limited to dialog-approved paths
   └── Processing services         sharp · jszip · pdf-lib · FFmpeg spawn
```

- **Registry-driven shell** — tools register a definition + lazy view in one
  file; the shell never imports tool internals. Tool #51 touches nothing else.
- **Structured errors end-to-end** — every thrown value crosses the boundary
  as a user-safe message with technical detail preserved for power users.
- **Mature libraries for hard formats** — sharp, jszip, pdf-lib, pdf.js,
  marked + DOMPurify, js-yaml, exifr, qrcode, jsQR. Hand-written parsers only
  where small enough to own (CSV, diffs, cron, page ranges).

## Verification culture

Verification is treated as part of correctness here:

- **553 unit/integration tests**, including suites that generate real PDFs,
  images and videos at runtime and assert on actual outputs.
- **Two CDP harnesses** launch the production build and drive the *real* DOM —
  clicking favorites, navigating views, dragging actual files — asserting
  behavior rather than boot success alone.
- A headless smoke mode proves services initialize inside Electron's main
  process.
- Per-tool checklist evidence lives in [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md).

## Documentation

| Doc | Contents |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements and scope |
| [`DESIGN.md`](DESIGN.md) | Visual direction, accessibility bar |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Process boundaries, lifecycle, extensibility |
| [`TOOL_SPEC.md`](TOOL_SPEC.md) | The contract every tool follows |
| [`AGENTS.md`](AGENTS.md) | Operating contract for autonomous development |
| [`LOOP.md`](LOOP.md) | Plan → implement → verify loop |
| [`VERIFY.md`](VERIFY.md) | Verification protocol |
| [`TASKS.md`](TASKS.md) | Task board |
| [`PROGRESS.md`](PROGRESS.md) | Current state and evidence |
| [`DECISIONS.md`](DECISIONS.md) | Architecture decision records |
| [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md) | Per-tool verification evidence |

## Status

All planned milestones complete and engineering-verified. The suite grows by
usage: new tools slot into the registry without touching the core. See
[`TASKS.md`](TASKS.md) for what's brewing.

<div align="center">

**Built locally, for local work.**

MIT License

</div>
