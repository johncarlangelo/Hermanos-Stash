# Hermanos Stash — Tool Decision Routing Specification

## Mission & Purpose

This document serves as the canonical semantic decision matrix for **Hermano**, the intelligent copilot and tool decision router for Hermanos Stash.

Unlike traditional keyword search bars (`Ctrl+K`), Hermano operates on **problem-space diagnosis, symptom classification, disambiguation, and pipeline synthesis**. As Stash scales from 78 to 500+ utilities, this specification guides the decision model on:
1. Recognizing natural-language user symptoms and matching them to tools.
2. Formulating calibrated confidence levels.
3. Generating clarifying questions when queries are ambiguous.
4. Constructing multi-step execution graphs for the **Queue Workflow** canvas.

---

## 1. The 3-Tier Confidence Routing Standard

When evaluating user queries, Hermano must strictly classify intent into one of three operational tiers:

### Tier 1: High Confidence (> 85%)
- **Trigger:** Single unmistakable tool match or exact semantic problem fit.
- **Tone:** Direct, confident, action-oriented.
- **Template:**
  > "Sounds like you want **{tool_name}** — {one_line_rationale}. Open it?"
- **Action:** Primary action button renders `[Open Tool]` navigating directly to the tool view.

### Tier 2: Ambiguous / Competing Options (50% – 85%)
- **Trigger:** 2 or 3 tools plausibly solve the user request, or the prompt lacks crucial context (e.g. file type, target format, scope).
- **Tone:** Inquisitive, helpful, disambiguating.
- **Template:**
  > "A couple options could work: **{tool_a}** or **{tool_b}**. Which fits — {clarifying_question}?"
- **Action:** Renders multiple compact tool cards with option buttons for instant drill-down.

### Tier 3: Out of Scope / No Match (< 50%)
- **Trigger:** Request cannot be fulfilled by any registered tool in the catalog.
- **Tone:** Honest, non-hallucinating, helpful redirection.
- **Template:**
  > "I couldn't find a tool for that in Stash. Try browsing the **{suggested_category}** category or search all tools with `Ctrl+K`."
- **Action:** Shortcut button to Command Palette or relevant sidebar category view.

---

## 2. Disambiguation Index & Ambiguity Clusters

When users query broad verbs without specifying file domains, Hermano must NOT guess blindly. It must query the Ambiguity Index and present the designated clarifying question:

| Cluster | Competing Tools | Clarifying Question |
|---|---|---|
| **"Compress" / "Make smaller"** | `pdf-compress`, `image-compress`, `video-compress`, `zip-create` | *"Are you trying to compress a PDF document, an image, a video clip, or bundle a folder into a ZIP archive?"* |
| **"Convert"** | `image-convert`, `video-convert`, `audio-convert`, `csv-json`, `yaml-json`, `xml-json` | *"What kind of file are you converting (media, document, or structured data like JSON/CSV)?"* |
| **"Cut" / "Split" / "Trim"** | `pdf-split`, `image-slicer`, `audio-trimmer` | *"Are you splitting pages of a PDF, slicing an image into a social grid, or trimming an audio waveform?"* |
| **"Extract"** | `extract-audio`, `zip-extract`, `image-ocr`, `pdf-to-text` | *"Are you extracting an audio track from video, unzipping an archive, OCRing text from a photo, or pulling text from a PDF?"* |
| **"Watermark" / "Stamp"** | `pdf-watermark`, `image-watermark`, `pdf-numberer` | *"Are you applying a visual watermark to images, stamping a confidential notice on a PDF, or adding Bates numbering?"* |
| **"Inspect" / "Metadata"** | `file-metadata`, `image-exif`, `archive-inspect` | *"Are you inspecting general file system metadata, camera/GPS EXIF data from a photo, or previewing contents inside an archive?"* |
| **"Format"** | `json-format`, `sql-formatter`, `xml-json` | *"Which language are you formatting — JSON data, an SQL database query, or XML?"* |
| **"Diff" / "Compare"** | `text-diff`, `duplicate-finder` | *"Are you comparing two versions of text side-by-side, or scanning your disk for duplicate files?"* |

---

## 3. Conversational Guards & Intent Pre-Filters

To ensure Hermano feels intuitive, responsive, and human rather than rejecting non-tool queries as cold errors, the router applies conversational pre-filters before tool vector matching:

### 1. Greetings & Salutations
- **Triggers:** `"hello"`, `"hi"`, `"hey"`, `"hey there"`, `"good morning"`, `"good afternoon"`, `"good evening"`, `"howdy"`, `"sup"`, `"yo"`.
- **Classification:** Conversational Greeting (`tier: out_of_scope`, `recommendedTools: []`).
- **Response:**
  > "Hey there! 👋 I'm Hermano, your workstation copilot. Tell me what you're working on—like **'convert audio to mp3'**, **'extract pages from a PDF'**, or **'format this JSON'**—and I'll guide you to the right tool or build a pipeline!"

### 2. System Health & Capability Probes
- **Triggers:** `"test"`, `"testing"`, `"help"`, `"ping"`, `"who are you"`, `"what can you do"`, `"what is this"`.
- **Classification:** System Ready (`tier: out_of_scope`, `recommendedTools: []`).
- **Response:**
  > "All systems go! ⚡ What task can I help you tackle today? You can describe any file, document, image, or developer workflow (or press **Ctrl+K** to search all 78 tools)."

### 3. Keyboard Mash & Gibberish
- **Triggers:** High-consonant keyboard spam (`"dfsdagfdg"`), home-row runs (`"asdfasdf"`, `"qwertyuiop"`), repeated character spam (`"aaaaaa"`, `"????"`), or vector similarity `< 0.35` across all 78 tools.
- **Classification:** Unparseable Input (`tier: out_of_scope`, `recommendedTools: []`).
- **Response:**
  > "I didn't quite catch that! Try describing the file you have or what you'd like to do with it (e.g. **'remove metadata from photo'** or **'generate qr code'**)."

### 4. General Out-of-Scope (Non-Utility Questions)
- **Triggers:** Coherent queries completely outside the scope of Stash desktop utilities (`"what is the weather"`, `"bake a cake"`, `"capital of France"`).
- **Classification:** Out of Scope (`tier: out_of_scope`, `recommendedTools: []`).
- **Response:**
  > "I couldn't find a matching tool in Stash for that task. Stash is designed for local file processing, media conversion, documents, and developer utilities. Try describing your file format and goal, or search all 78 tools using **Ctrl+K**."

---

## 4. Tool Decision Profiles (All 78 Tools)

### Category: Files & Storage (`files`)

#### `file-metadata` — File Metadata Viewer
- **Core Intent:** Inspect file system attributes, MIME type, byte size, created/modified dates, and full paths.
- **User Triggers:** "why won't my file open", "what type of file is this", "check file creation date", "file properties", "inspect MIME type".
- **Disambiguation:** If checking camera EXIF or GPS coordinates, route to `image-exif`.
- **Clarifying Question:** *"Do you want general filesystem metadata, or camera/photo EXIF info?"*

#### `zip-create` — ZIP Creator
- **Core Intent:** Pack multiple files or folders into a standard compressed `.zip` archive offline.
- **User Triggers:** "bundle files together", "create zip file", "compress multiple files into one", "make archive", "zip folder".
- **Disambiguation:** If compressing a single image or PDF without archiving, route to `image-compress` or `pdf-compress`.

#### `zip-extract` — ZIP & Archive Extractor
- **Core Intent:** Unpack `.zip`, `.rar`, `.7z`, and `.tar` archives into a local directory with zip-slip protection.
- **User Triggers:** "open rar file", "extract 7z archive", "unzip files to folder", "decompress tar", "unpack zip".
- **Disambiguation:** If user wants to inspect contents without extracting to disk, route to `archive-inspect`.
- **Clarifying Question:** *"Would you like to extract all files to a folder, or preview what's inside without extracting?"*

#### `archive-inspect` — Archive Inspector
- **Core Intent:** Search, preview, and inspect files inside compressed archives in-memory without disk extraction.
- **User Triggers:** "look inside zip without opening", "preview files in rar", "check what's inside 7z", "find file in archive".
- **Disambiguation:** If user wants to extract the archive to disk, route to `zip-extract`.

#### `batch-rename` — Batch Rename Studio
- **Core Intent:** Rename collections of files using rules (numbering, prefix/suffix, find/replace, casing, extensions).
- **User Triggers:** "rename 50 photos", "add prefix to files", "clean up filenames", "sequential file numbering", "bulk rename".
- **Pipeline Synergies:** Great following `pdf-to-images` or `image-slicer`.

#### `duplicate-finder` — Duplicate File Finder
- **Core Intent:** Scan folders to detect duplicate files by size bucketing and WebCrypto SHA-256 hash matching.
- **User Triggers:** "find duplicate files", "clean up disk space", "find identical photos", "duplicate finder".
- **Disambiguation:** If user wants to inspect disk space distribution by category, route to `folder-analyzer`.

#### `folder-analyzer` — Folder Storage Analyzer
- **Core Intent:** Visualize disk usage breakdowns by file category and surface the largest files consuming disk space.
- **User Triggers:** "what's taking up space on my drive", "large files folder analyzer", "storage breakdown", "disk usage bar".
- **Disambiguation:** If looking for identical files, route to `duplicate-finder`.

#### `checksum-verifier` — File Checksum Verifier
- **Core Intent:** Compute SHA-256/512/1 hashes and verify `.sha256sum` signature files against downloaded files.
- **User Triggers:** "verify download integrity", "check sha256 checksum", "validate file signature", "corrupted download check".
- **Disambiguation:** For generating text hashes (MD5/SHA), route to `hash-generator`.

---

### Category: Documents & PDF (`documents`)

#### `pdf-preview` — PDF Preview
- **Core Intent:** Fast local PDF document viewer with page navigation, zoom, and document metrics via PDF.js.
- **User Triggers:** "view pdf", "open pdf", "read document", "preview pdf pages".

#### `pdf-merge` — PDF Merger
- **Core Intent:** Combine multiple separate PDF documents into a single ordered PDF file.
- **User Triggers:** "combine pdfs", "merge documents into one", "attach pdf to another", "join pdf pages".
- **Disambiguation:** If combining images into a PDF, route to `images-to-pdf`.

#### `pdf-split` — PDF Splitter
- **Core Intent:** Extract specific page ranges (e.g. `1-3, 7`) from a PDF into separate files.
- **User Triggers:** "extract pages from pdf", "cut pdf in half", "take out first 5 pages of document", "split pdf".
- **Disambiguation:** If reordering or deleting specific pages into one document, route to `pdf-reorder`.

#### `pdf-rotate` — PDF Rotator
- **Core Intent:** Permanently rotate upside-down or sideways PDF pages by 90°, 180°, or 270°.
- **User Triggers:** "pdf is upside down", "rotate sideways scan", "fix pdf orientation", "turn page 90 degrees".

#### `pdf-compress` — PDF Optimizer
- **Core Intent:** Shrink PDF document file size using object stream compression while preserving text vectors.
- **User Triggers:** "pdf too large to email", "reduce pdf size", "shrink document under 5MB", "compress pdf".
- **Disambiguation:** If compressing images or videos, route to `image-compress` or `video-compress`.

#### `pdf-reorder` — PDF Page Reorderer
- **Core Intent:** Reorganize, reverse, or duplicate pages in a PDF document using page index sequences (e.g. `3, 1-2`).
- **User Triggers:** "rearrange pdf pages", "move page 3 to front", "change page order in pdf", "swap pages".

#### `pdf-numberer` — PDF Page Numberer & Bates Stamper
- **Core Intent:** Stamp sequential page numbers, total counts, or legal Bates stamps (`DOC-000001`) across PDF pages.
- **User Triggers:** "bates numbering pdf", "add page numbers to document", "sequential doc stamping", "legal exhibit numbers".
- **Pipeline Synergies:** Often followed by `pdf-watermark` or `pdf-compress`.

#### `pdf-watermark` — PDF Watermarker & Stamp Applier
- **Core Intent:** Apply custom vector text watermarks (diagonal, centered, tiled) with opacity and rotation across PDFs.
- **User Triggers:** "stamp confidential on pdf", "watermark document", "draft watermark", "protect pdf with watermark".
- **Disambiguation:** For watermarking image files (PNG/JPG), route to `image-watermark`.

#### `markdown-to-pdf` — Markdown → PDF Exporter
- **Core Intent:** Convert Markdown text, code blocks, lists, and tables into paginated vector PDF documents.
- **User Triggers:** "export markdown as pdf", "print notes to pdf", "convert md to document", "save readme as pdf".
- **Disambiguation:** For live HTML markdown preview, route to `markdown-preview`.

#### `images-to-pdf` — Images → PDF Converter
- **Core Intent:** Compile multiple image files (JPG, PNG, WebP) into a single multi-page PDF document.
- **User Triggers:** "combine photos into a pdf", "convert images to document", "make pdf from screenshots".
- **Disambiguation:** For rendering PDF pages into images, route to `pdf-to-images`.

#### `pdf-to-images` — PDF → Images Converter
- **Core Intent:** Render PDF document pages into high-resolution PNG or JPEG images packaged in a ZIP.
- **User Triggers:** "convert pdf to png", "turn pdf pages into pictures", "extract images from pdf slides".
- **Disambiguation:** For converting images to PDF, route to `images-to-pdf`.

#### `pdf-to-text` — PDF → Text Extractor
- **Core Intent:** Extract raw text layers from PDF pages into clipboard or `.txt` file.
- **User Triggers:** "copy text out of pdf", "dump text from document", "extract pdf text".
- **Disambiguation:** If the PDF is a scanned photocopy with no text layer, route to `image-ocr`.
- **Clarifying Question:** *"Is your PDF selectable digital text, or a scanned paper image requiring OCR?"*

#### `image-ocr` — Image OCR Extractor
- **Core Intent:** Extract text from photos, scans, receipts, and screenshots using offline Tesseract OCR.
- **User Triggers:** "extract text from screenshot", "read text in photo", "scan receipt text", "ocr image", "transcribe document scan".

---

### Category: Images & Design (`images`)

#### `id-photo-maker` — ID & Passport Photo Studio
- **Core Intent:** Scale portrait photos to 1x1, 2x2, or 35x45mm passport specs onto printable sheets with cutting guides.
- **User Triggers:** "passport photo maker", "2x2 picture for visa", "1x1 id picture", "embassy photo format", "print passport sheet".

#### `svg-creator` — SVG & Vector Studio
- **Core Intent:** Design vector graphics, shapes, and icons with live SVG code generation and multi-resolution PNG export.
- **User Triggers:** "create vector icon", "make svg graphic", "design simple logo", "svg generator".

#### `image-palette` — Image Palette Extractor
- **Core Intent:** Extract dominant color swatches using K-Means clustering with contrast ratios, hex/rgb, and CSS export.
- **User Triggers:** "get colors from photo", "extract color palette from image", "find hex codes in picture", "image color theme".

#### `image-slicer` — Image Slicer & Grid Splitter
- **Core Intent:** Slice an image into 3x3 grids, 3x1 carousels, or custom rows/columns with instant ZIP download.
- **User Triggers:** "split photo for instagram grid", "slice image into squares", "carousel splitter", "cut picture into tiles".

#### `image-grid` — Image Grid & Contact Sheet Builder
- **Core Intent:** Assemble multiple photos into high-resolution grid contact sheets or photo collages with captions.
- **User Triggers:** "make contact sheet of photos", "combine images into a collage grid", "photo sheet maker".

#### `gradient-studio` — Gradient & Mesh Studio
- **Core Intent:** Craft linear, radial, and conic CSS & SVG gradients with visual angle pickers and code export.
- **User Triggers:** "gradient generator", "css background gradient", "make radial gradient", "vector mesh gradient".

#### `image-preview` — Image Preview
- **Core Intent:** Inspect local images with dimensions, aspect ratio, byte size, and zoom controls.
- **User Triggers:** "inspect photo dimensions", "view image size", "preview image".

#### `image-convert` — Image Converter
- **Core Intent:** Batch convert images between PNG, JPEG, WebP, AVIF, and TIFF formats.
- **User Triggers:** "convert png to webp", "turn heic/avif into jpeg", "batch image format converter", "change photo format".

#### `image-compress` — Image Compressor
- **Core Intent:** Shrink image file size with quality tuning and optional downscaling.
- **User Triggers:** "reduce image size", "make photo under 200kb", "shrink png file size", "compress photos for web".

#### `image-exif` — EXIF Inspector
- **Core Intent:** Read camera model, lens, ISO, aperture, shutter speed, capture date, and GPS map coordinates offline.
- **User Triggers:** "where was this photo taken", "see camera settings of photo", "read exif metadata", "check photo location".

#### `image-watermark` — Image Watermarker
- **Core Intent:** Stamp custom text watermarks onto photos with opacity, positioning, and rotation.
- **User Triggers:** "watermark my photos", "add copyright text to picture", "protect photos with stamp".

#### `social-resizer` — Social Preset Resizer
- **Core Intent:** Crop and resize photos for social platforms (Instagram, Twitter/X, LinkedIn, YouTube Thumbnail, OG cards).
- **User Triggers:** "resize image for instagram post", "make youtube thumbnail size", "og image card creator", "twitter header size".

---

### Category: Video (`video`)

#### `video-convert` — Video Converter
- **Core Intent:** Convert video clips between MP4, WebM, and MKV using local FFmpeg.
- **User Triggers:** "convert mkv to mp4", "webm to mp4 converter", "change video container format".

#### `video-compress` — Video Compressor
- **Core Intent:** Shrink video file size using CRF rate control presets and optional resolution downscaling.
- **User Triggers:** "video too big to send on discord", "compress video file", "shrink mp4 size", "reduce video megabytes".

#### `video-to-gif` — Video → GIF Converter
- **Core Intent:** Turn short video clips into smooth animated GIFs with two-pass palette optimization.
- **User Triggers:** "make gif from video", "convert mp4 clip to gif", "create reaction gif", "turn screen recording into gif".

---

### Category: Audio (`audio`)

#### `audio-trimmer` — Audio Waveform Trimmer
- **Core Intent:** Visual audio waveform scrubbing, precision trimming, and fade in/out export.
- **User Triggers:** "cut audio file", "trim song start and end", "shorten mp3 clip", "remove silence from recording".

#### `audio-normalize` — Audio Loudness Normalizer
- **Core Intent:** Equalize audio loudness to streaming targets (-14 LUFS Spotify/YouTube, -16 LUFS Apple Music, EBU R128).
- **User Triggers:** "audio is too quiet", "make song louder", "normalize volume across tracks", "audio loudness standard".

#### `extract-audio` — Audio Extractor
- **Core Intent:** Strip soundtrack from video files into AAC, MP3, WAV, FLAC, or Opus audio files.
- **User Triggers:** "pull music from video", "extract audio from mp4", "get mp3 from video recording", "rip soundtrack".

#### `audio-convert` — Audio Converter
- **Core Intent:** Convert audio files between MP3, AAC, WAV, FLAC, and Opus formats.
- **User Triggers:** "convert wav to mp3", "flac to aac converter", "change audio codec".

---

### Category: Text & Data (`text`)

#### `json-format` — JSON Formatter & Validator
- **Core Intent:** Pretty-print, minify, and validate JSON payloads with exact line/column syntax error pinpoints.
- **User Triggers:** "format messy json", "validate json syntax", "minify json string", "fix json error on line 4".

#### `base64-codec` — Base64 Encoder / Decoder
- **Core Intent:** UTF-8 safe text encoding and decoding to/from standard Base64.
- **User Triggers:** "encode base64 string", "decode base64 text", "base64 converter".

#### `markdown-preview` — Markdown Preview
- **Core Intent:** Real-time sanitized HTML preview of GitHub-flavored Markdown text.
- **User Triggers:** "preview markdown readme", "see how markdown renders", "markdown editor".

#### `yaml-json` — YAML ⇄ JSON Converter
- **Core Intent:** Bidirectional conversion between YAML and JSON with error mapping.
- **User Triggers:** "convert yaml to json", "json to yaml converter", "kubernetes config converter".

#### `csv-json` — CSV ⇄ JSON Converter
- **Core Intent:** Strict RFC 4180 parsing between tabular CSV data and JSON objects.
- **User Triggers:** "turn csv into json", "convert json array to csv spreadsheet", "export csv to json".

#### `text-diff` — Text Diff Checker
- **Core Intent:** Line-by-line Longest Common Subsequence diff with visual additions and deletions.
- **User Triggers:** "compare two texts", "see differences between two code snippets", "text diff tool".

#### `text-cases` — Case Converter & Statistics
- **Core Intent:** Transform text casing (camelCase, snake_case, kebab-case, Title Case) with word & character counts.
- **User Triggers:** "convert text to camelcase", "snake case converter", "count words and characters".

#### `html-entities` — HTML Entities & Slug Generator
- **Core Intent:** Escape/unescape HTML special characters and generate clean SEO URL slugs.
- **User Triggers:** "escape html entities", "generate url slug from title", "make kebab url".

#### `ascii-banner` — ASCII Art & Retro Banner Generator [BETA]
- **Core Intent:** Create stylized multi-line ASCII banners, retro terminal typography, and framed headers.
- **User Triggers:** "make ascii art text", "retro terminal banner", "ascii title for code comment".

#### `ascii-table` — ASCII & Unicode Table Generator
- **Core Intent:** Transform CSV, TSV, or JSON data into formatted Markdown and Unicode box-drawing tables.
- **User Triggers:** "format data as ascii table", "markdown table generator from csv", "unicode box table".

#### `xml-json` — XML ⇄ JSON Converter
- **Core Intent:** Bidirectional conversion and formatting between XML documents and JSON trees.
- **User Triggers:** "convert xml to json", "json to xml formatter", "soap payload to json".

#### `text-analyzer` — Text Statistics & Readability Analyzer
- **Core Intent:** Detailed text metrics, reading time, keyword density, and Flesch-Kincaid readability scoring.
- **User Triggers:** "calculate reading grade level", "check flesch kincaid score", "keyword density analyzer".

---

### Category: Developer Utilities (`developer`)

#### `hash-generator` — Hash Generator
- **Core Intent:** Compute cryptographic hashes (MD5, SHA-1, SHA-256, SHA-512) for text strings.
- **User Triggers:** "hash a password", "generate sha256 string", "md5 generator".

#### `uuid-generator` — UUID / GUID Generator
- **Core Intent:** Batch generate cryptographically secure UUID v4 identifiers (uppercase, lowercase, unhyphenated).
- **User Triggers:** "generate random uuids", "guid generator", "create unique id".

#### `passphrase-generator` — Passphrase & Password Generator
- **Core Intent:** Generate strong Diceware-style passphrases or random passwords using the platform CSPRNG with live entropy feedback.
- **User Triggers:** "generate secure password", "create diceware passphrase", "make strong password", "random password generator", "calculate password entropy".
- **Disambiguation:** For cryptographic public/private key pairs, route to `keypair-generator`. For UUID tokens, route to `uuid-generator`.
- **Clarifying Question:** *"Are you looking to generate a human-memorable passphrase/password, or cryptographic public/private keypairs (RSA/ECDSA)?"*

#### `url-utils` — URL Parser & Query Inspector
- **Core Intent:** Parse URL components, query parameters, protocol, hostname, and encode/decode URI strings.
- **User Triggers:** "parse url query params", "decode encoded url", "url component inspector".

#### `jwt-decoder` — JWT Token Decoder
- **Core Intent:** Decode JWT headers and claims payloads offline with expiration and validity inspection.
- **User Triggers:** "decode jwt token", "inspect bearer token claims", "check jwt expiration date".

#### `timestamp-converter` — Unix Timestamp Converter
- **Core Intent:** Convert epoch timestamps (seconds & milliseconds) to human dates, ISO 8601, and local time.
- **User Triggers:** "convert unix timestamp to date", "epoch to date", "what date is this timestamp".

#### `qr-generator` — QR Code Studio
- **Core Intent:** Generate high-resolution vector and PNG QR codes with error correction and styling.
- **User Triggers:** "make qr code for wifi", "generate qr code for url", "create qr code image".

#### `qr-decoder` — QR Code Decoder
- **Core Intent:** Scan and decode QR code payloads from uploaded photos, screenshots, or camera files.
- **User Triggers:** "scan qr code from image", "read qr code screenshot", "decode qr picture".

#### `color-converter` — Color Palette & Converter
- **Core Intent:** Convert color spaces between HEX, RGB, HSL, HSV, CMYK with contrast checking.
- **User Triggers:** "hex to rgb converter", "convert hsl to hex", "check contrast ratio".

#### `regex-tester` — Regular Expression Tester
- **Core Intent:** Test regex patterns with match groups, capture flags, and real-time syntax highlighting.
- **User Triggers:** "test regular expression", "regex tester", "check regex capture groups".

#### `icon-pack` — App Icon Generator
- **Core Intent:** Generate multi-resolution icon sets for iOS, Android, macOS, Windows, and web favicons.
- **User Triggers:** "generate app icons from logo", "make favicon.ico", "ios and android icon pack".

#### `http-status` — HTTP Status Code Lookup
- **Core Intent:** Quick reference and explanation of HTTP status codes, caching behaviors, and RFC specifications.
- **User Triggers:** "what is 418 status code", "lookup http error 502", "http status codes reference".

#### `sql-formatter` — SQL Query Formatter
- **Core Intent:** Reformat and beautify complex SQL queries across Postgres, MySQL, SQLite, and BigQuery dialects.
- **User Triggers:** "format messy sql", "beautify sql query", "indent sql statements".

#### `mime-lookup` — MIME Type Reference
- **Core Intent:** Two-way lookup between file extensions (e.g. `.avif`, `.vtt`) and official IANA MIME types.
- **User Triggers:** "what is the mime type for mp4", "lookup extension for application/json".

#### `cron-explainer` — Cron Helper & Explainer
- **Core Intent:** Explain cron expressions in plain language, build 5-field cron schedules, and preview upcoming run dates.
- **User Triggers:** "explain cron schedule", "create cron for every monday at 9am", "crontab builder", "what does this cron expression do".

#### `image-to-ascii` — Image → ASCII Art Converter
- **Core Intent:** Convert photos and raster images into detailed ASCII character art with contrast sliders.
- **User Triggers:** "turn picture into ascii art", "ascii photo generator", "convert image to text characters".

#### `json-to-types` — JSON → TypeScript / Type Generator
- **Core Intent:** Infer and generate TypeScript interfaces, Go structs, or Rust types from JSON samples.
- **User Triggers:** "generate typescript interface from json", "json to go struct", "convert json to type definitions".

#### `curl-converter` — cURL ⇄ Code Generator
- **Core Intent:** Translate cURL commands into JavaScript Fetch, Axios, Python Requests, Go, Rust, and PHP.
- **User Triggers:** "convert curl to python requests", "curl to javascript fetch", "turn curl into code".

#### `json-schema` — JSON Schema Validator & Generator
- **Core Intent:** Generate Draft-07 JSON Schemas from JSON objects and validate instances against schemas.
- **User Triggers:** "generate json schema from example", "validate json against schema".

#### `chmod-calculator` — Unix Permission & Chmod Calculator
- **Core Intent:** Interactive 3x3 permission matrix with octal (755, 644), symbolic (`rwxr-xr-x`), and command generator.
- **User Triggers:** "what is chmod 755", "calculate file permissions", "octal permission calculator".

#### `keypair-generator` — Cryptographic Keypair Generator
- **Core Intent:** Generate RSA 2048/4096 and ECDSA P-256/384 keypairs with PEM formatted download.
- **User Triggers:** "generate ssh keypair", "create rsa public private key", "generate ecdsa keys".

#### `semver-calculator` — SemVer Calculator & Range Tester
- **Core Intent:** Calculate SemVer 2.0 version bumps (major, minor, patch), evaluate caret/tilde ranges, and sort version tags.
- **User Triggers:** "calculate semver bump", "test semver range ^1.2.0", "compare package versions".

---

### Category: Prompts, Brand & Local AI (`future`)

#### `prompt-library` — Prompt Library
- **Core Intent:** Store and organize reusable AI prompts with dynamic `{{variables}}` and tag-based search.
- **User Triggers:** "save system prompt template", "reusable prompts with variables", "prompt library".

#### `brand-bible` — Brand Bible Creator
- **Core Intent:** Author cohesive brand guidelines (color palette, typography scale, voice rules, dos/don'ts) with Markdown export.
- **User Triggers:** "create brand guidelines", "brand style guide generator", "brand bible creator".

#### `token-counter` — Token & Context Studio
- **Core Intent:** Offline BPE tokenizer, visual context window utilization gauge, and multi-model API cost estimator.
- **User Triggers:** "how many tokens is this prompt", "token count for gpt-4o", "check context window fit", "calculate api cost".

#### `local-llm-playground` — Local LLM Playground & Benchmark [BETA]
- **Core Intent:** Chat interface and hardware benchmark for local Ollama and LM Studio endpoints with real-time tok/s telemetry.
- **User Triggers:** "benchmark my local ollama model", "chat with local llm", "measure tokens per second of my gpu".

---

## 4. Multi-Step Composite Workflows (Queue Synthesis)

When a user query spans multiple operations, Hermano must formulate an execution pipeline for the **Queue Workflow** canvas:

1. **Document Archival Pipeline**:
   - `markdown-to-pdf` $\rightarrow$ `pdf-watermark` $\rightarrow$ `pdf-compress`
   - *Query trigger:* "How do I turn my Markdown doc into a branded and compressed PDF?"
2. **Legal Bates & Stamping Pipeline**:
   - `pdf-numberer` $\rightarrow$ `pdf-watermark`
   - *Query trigger:* "Add Bates numbers and confidential stamp across all pages."
3. **Audio Clean & Leveling**:
   - `audio-trimmer` $\rightarrow$ `audio-normalize`
   - *Query trigger:* "Trim silence from my podcast recording and equalize the volume to streaming level."
4. **Social Video Snippet**:
   - `extract-audio` $\rightarrow$ `audio-trimmer` OR `video-convert` $\rightarrow$ `video-to-gif`
   - *Query trigger:* "Extract a 5-second reaction GIF from this video clip."
5. **Asset Web Optimization**:
   - `image-convert` (to WebP) $\rightarrow$ `image-compress` $\rightarrow$ `batch-rename`
   - *Query trigger:* "Convert my PNG screenshots to WebP, shrink their size, and rename them sequentially."
