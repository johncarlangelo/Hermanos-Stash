<div align="center">

# HERMANOS STASH

**One window. 78 tools. Local-first.**

A local-first desktop toolbox for files, documents, images, video, audio,
text, developer work and reusable AI prompts — built for processing on your
machine. Optional model-server connections power the experimental LLM playground.

![Tools](https://img.shields.io/badge/tools-78-d9a35c)
![Tests](https://img.shields.io/badge/tests-Vitest-85bb90)
![License](https://img.shields.io/badge/license-MIT-9aa2b1)
![Electron](https://img.shields.io/badge/Electron-43-2b2f3a)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3b82f6)
![Local-first](https://img.shields.io/badge/local--first-no_required_cloud-important)

</div>

---

> Small file problems come up constantly — *split this PDF*, *shrink these
> images*, *extract the audio*, *format that JSON*. The usual answer is a
> different sketchy web page for each one.
>
> **Stash is the opposite bet:** one installed app you can trust, built around local processing. No accounts or paid APIs are required.
> Local AI inference needs a separately installed model server; its simulation
> sandbox works without one.

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
cd Hermanos-Stash
npm install
npm run dev          # launches the app with hot reload
```

**System Dependencies (On-Demand 1-Click Install):** To keep the application installer
lean and lightweight, heavy external binaries are not bundled into the download. In **Settings**,
Hermanos Stash provides 1-click on-demand installation for missing dependencies:
- **FFmpeg & FFprobe (~25 MB):** Installs prebuilt static binaries into `resources/ffmpeg/` for video & audio processing tools.
- **Tesseract OCR Language Data (~4 MB):** Downloads `eng.traineddata` into `resources/tessdata/` for local OCR extraction.
- **MiniLM Semantic Decision Router (~23 MB):** Downloads quantized ONNX vector model (`all-MiniLM-L6-v2`) into `resources/models/` for 100% offline Hermano intent routing.
- **Local LLM Providers:** Optionally connect to existing local servers like Ollama or LM Studio.



### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl K` | Command palette — fuzzy-search all 78 tools |
| `Ctrl /` | Toggle Hermano (Copilot & Decision Router) |
| `Esc` | Back to workspace / close modals |
| `Ctrl 1–5` | Open your first five favorites |
| Drag file → window background | Find matching tools |

## The catalog — 78 tools

<details>
<summary><strong>Text & Data</strong> — 12 tools</summary>

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
| ASCII Art & Retro Banner Generator **BETA** | Create multi-line ASCII art, retro terminal banners, and framed typography. |
| ASCII & Unicode Table Generator | Convert CSV, TSV, and JSON data into formatted Unicode and Markdown tables. |
| XML ⇄ JSON Converter & Formatter | Bi-directional XML and JSON converter with custom attribute prefixes. |
| Text Statistics & Readability Analyzer | Analyze word counts, reading time, keyword density, and Flesch-Kincaid readability. |

</details>

<details>
<summary><strong>Files & Archives</strong> — 8 tools</summary>

| Tool | What it does |
|---|---|
| File Metadata Viewer | Size, dates, MIME type, full path — multi-file |
| ZIP Creator | Pack any mix of files into one archive |
| ZIP Extractor | Extract archives with zip-slip protection |
| Batch Rename | Pattern-based bulk renaming with dry-run preview |
| Archive Inspector | Inspect, search, and preview files inside .zip, .rar, .7z, and .tar archives in-memory without extracting them to disk. |
| Duplicate File & Hash Matcher | Find identical duplicate files by size and SHA-256 hash to reclaim disk space. |
| Disk Space & Folder Tree Analyzer | Inspect storage distribution, media category breakdown, and largest files. |
| File Checksum Signature Verifier | Verify file integrity using SHA-256, SHA-512, and standard .sha256sum files. |

</details>

<details>
<summary><strong>Images</strong> — 13 tools</summary>

| Tool | What it does |
|---|---|
| Image Preview | Dimensions, size, fit + zoom controls |
| Image Converter | Batch PNG / JPEG / WebP / AVIF / TIFF |
| Image Compressor | Batch compression with downscaling, shows bytes saved |
| EXIF Inspector | Camera, lens, exposure, date, GPS metadata |
| Image Watermarker | Batch text stamps with position and opacity control |
| Social Preset Resizer | og:image, X card, Instagram, YouTube — smart crop |
| SVG & Vector Studio **BETA** | Design vector shapes, graphics, and icons with live code generation and multi-format export. |
| Image → ASCII Art Converter **BETA** | Convert photos and graphics into customizable ASCII & ANSI text art. |
| Image Color Palette & Swatch Extractor | Extract dominant color palettes with WCAG contrast ratios, CSS variables, and Tailwind export. |
| Image Slicer & Grid Splitter | Split images into tiles; download individual images or a ZIP. |
| Contact Sheet & Collage Grid Builder | Combine multiple images into high-resolution photo contact sheets and collages. |
| CSS & Vector Gradient Studio | Design gradients; copy CSS/SVG or download a PNG. |
| ID & Passport Photo Studio | Scale, crop, and tile portrait photos onto printable 1x1, 2x2, and passport sheets with cutting guides ready for Word and PDF export. |

</details>

<details>
<summary><strong>Documents & PDF</strong> — 13 tools</summary>

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
| Image OCR Extractor | Extract editable text from images, photos, scans, and screenshots locally using offline Tesseract OCR. |
| PDF Page Numberer & Bates Stamper | Stamp sequential page numbers, Bates numbers, and custom headers onto PDF pages. |
| PDF Watermarker & Stamp Applier | Stamp confidential watermarks and diagonal text stamps across PDF documents. |
| Markdown / Text → PDF Exporter | Render formatted Markdown notes and specifications into paginated vector PDF documents. |

</details>

<details>
<summary><strong>Video & Audio</strong> — 7 tools · 5 FFmpeg-backed, 2 Web Audio</summary>

Video Converter, Video Compressor, Video → GIF, Audio Extractor and Audio Converter
use FFmpeg. Audio Trimmer and Audio Normalizer use Web Audio instead. FFmpeg-backed
converters validate outputs after processing; format support depends on the tool.

| Tool | What it does |
|---|---|
| Video Converter | MP4 / WebM / MKV with CRF quality control |
| Video Compressor | Quality presets plus resolution capping |
| Video → GIF | Two-pass palette-optimized GIFs |
| Audio Extractor | Pull soundtracks as AAC / MP3 / WAV / FLAC / Opus |
| Audio Converter | Convert between the same codecs |
| Audio Waveform Visualizer & Trimmer | Visual waveform scrubber with start/end markers, fade envelopes, and lossless WAV export. |
| Audio Loudness & Volume Normalizer | Adjust gain to a target peak or RMS level in dBFS using Web Audio; not integrated LUFS/EBU R128 normalization. |

</details>

<details>
<summary><strong>Developer</strong> — 21 tools</summary>

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
| cURL ⇄ Multi-Language Code Generator | Convert cURL commands into JavaScript Fetch, Axios, Python Requests, Go, Rust, and PHP. |
| JSON Schema Validator & Generator | Generate JSON Schema Draft-07 from sample payloads and validate data live. |
| Chmod & Unix Permission Calculator | Interactive 3x3 permission matrix with octal, symbolic, and natural language explainers. |
| Cryptographic Keypair Generator | Generate RSA 2048/4096 and ECDSA P-256/384 keypairs with PEM export. |
| SemVer Calculator & Range Tester | Calculate SemVer 2.0 bumps, test version ranges (^, ~), and sort version lists. |

</details>

<details open>
<summary><strong>Prompts, Brand & Local AI</strong> — 4 tools · local-first</summary>

| Tool | What it does |
|---|---|
| Prompt Library | Reusable prompts with `{{variables}}` you fill before copying — search, tags, starter pack, JSON import/export |
| Brand Bible Creator | Compose a brand guide: colors with auto palettes and contrast, type scale, voice, usage rules — export as Markdown/JSON |
| Token & Context Studio | Offline BPE token counter, context window visualizer, and local LLM API cost estimator. |
| Local LLM Playground & Benchmark **BETA** | Chat, test prompts, and benchmark local Ollama and LM Studio models on your hardware with real-time tokens/sec telemetry. |

</details>

## Queue Workflow — BETA

Open **Queue** to arrange tools on a visual canvas, connect file/text ports,
load built-in recipes, and save or import/export workflows. A linear queue view
is also available.

- **Directional media-domain validation:** Audio Extractor → Icon Pack is rejected;
  Image Compressor → Icon Pack is allowed. Sidebar category does not determine compatibility.
- **Saved/imported graph preflight:** connections are rechecked before any node starts.
- **Exhaustive static audit:** 78 tools, 6,084 ordered pairs and **24,336 port combinations**.
  See the [compatibility matrix](docs/workflow-audit/COMPATIBILITY_MATRIX.md).

> **BETA limits:** pipeline execution is still simulated; this is not real processor
> chaining. Valid wires do not guarantee codec/extension or text-content compatibility.
> The legacy Photo ID recipe loads for editing but its mixed-output connection fails
> preflight. Linear Queue still uses its separate capability-only validator.
> See [audit scope and limitations](docs/workflow-audit/README.md).

After adding or changing a tool, update its capabilities, media domains and independently
reviewed audit fixture, then run:

```bash
npm run workflow:matrix        # Run workflow tests; regenerate Markdown and CSVs
npm run workflow:matrix:check  # Run validation; fail on missing/stale artifacts without rewriting them
```

These are developer/agent commands, not required at app startup. AGENTS.md mandates
them for tool integration; there is no automatic Git hook or CI job installed.

## Hermano — Local Copilot & Decision Router (BETA)

Click the animated floating orb at the bottom-right of the window (or press `Ctrl /`) to open **Hermano**, Stash's intelligent decision router:

- **ThinkingOrb Integration:** Powered by the lightweight `thinking-orbs` canvas library with hand-tuned animated states (`listening`, `searching`, `solving`, `breathing`).
- **Offline Semantic Decision Engine (MiniLM):** Powered by the lightweight quantized `all-MiniLM-L6-v2` ONNX model (**~22.7 MB** download size, ~23.4 MB total with tokenizer). Vectorizes natural-language queries into 384-dimensional dense space in ~10 ms, matching against precomputed tool vectors via cosine similarity in <1 ms.
- **Problem-Driven Routing:** Instead of memorizing tool names, describe your goal (e.g. *"I have a 100-page PDF, how do I add bates numbers and watermark each page?"*).
- **Zero Background Overhead & 3-Min Idle Eviction:** The model is NEVER loaded at startup. It initializes on-demand only when a query is sent and consumes **~40–60 MB of RAM**. If inactive for 3 minutes (or when the widget is closed), the session automatically unloads and releases all RAM back to the operating system.
- **3-Tier Confidence Routing:** Adheres to [`TOOL_ROUTING.md`](TOOL_ROUTING.md) with High Confidence (>85%), Ambiguity Clusters (50–85% with clarifying questions), and Out-of-Scope graceful fallbacks.
- **Direct Navigation:** Jump straight to recommended tools with a single click.
- **Workflow Synthesis:** Automatically identifies multi-step tasks and offers a one-click shortcut into the Visual Queue canvas.
- **100% Local-First:** Runs entirely inside the local desktop application without cloud requirements or telemetry.


## Tool #78: Local LLM Playground & Benchmark — BETA

Chat with local models, try system prompts and generation settings, and inspect
throughput (tokens/sec) and time to first token. The default endpoints are
**Ollama** (`http://localhost:11434`) and **LM Studio** (`http://localhost:1234`).
Start your chosen server and load a model separately; Stash does not bundle model weights.

An **Offline Simulation Sandbox** lets you explore the interface without a running
model server. Its responses and benchmark numbers are simulated, not hardware results.
Real inference sends prompts to the selected endpoint; keep it local for local-only use.
Endpoint compatibility and benchmark behavior remain experimental.

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
  file; the shell never imports tool internals. New tools also update tests,
  capability/domain declarations and documentation.
- **Structured errors end-to-end** — every thrown value crosses the boundary
  as a user-safe message with technical detail preserved for power users.
- **Mature libraries for hard formats** — sharp, jszip, pdf-lib, pdf.js,
  marked + DOMPurify, js-yaml, exifr, qrcode, jsQR. Hand-written parsers only
  where small enough to own (CSV, diffs, cron, page ranges).

## Verification culture

Verification is treated as part of correctness here:

- **Vitest unit/integration tests**, including suites that generate real PDFs,
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
| [`TOOL_ROUTING.md`](TOOL_ROUTING.md) | Decision router intent matrix, ambiguity index, and confidence tiers |
| [`VERIFICATION_LOG.md`](VERIFICATION_LOG.md) | Per-tool verification evidence |


## Status

78 tools are registered. Queue Workflow and selected tools remain **BETA**;
visual pipeline execution is simulated, not production processor chaining. See
[`TASKS.md`](TASKS.md) for what's brewing.

<div align="center">

**Built locally, for local work.**

MIT License

</div>
