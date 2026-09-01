# Hermanos Stash — Tool Catalog

This is a living catalog tracking shipped tools and workstation capabilities. Currently **75 tools** are implemented and registered across 8 categories.

## Files & Storage (`files`)

- [x] **File Metadata Viewer** (`file-metadata`) — Inspect size, dates, MIME type, and full path for any local file.
- [x] **ZIP Creator** (`zip-create`) — Pack any mix of files into a single `.zip` archive entirely locally.
- [x] **ZIP & Archive Extractor** (`zip-extract`) — Extract `.zip`, `.rar`, `.7z`, and `.tar` archives into a target directory with password and zip-slip protection.
- [x] **Archive Inspector** (`archive-inspect`) — Inspect, search, and preview files inside `.zip`, `.rar`, `.7z`, and `.tar` archives in-memory without extracting to disk.
- [x] **Batch Rename** (`batch-rename`) — Multi-rule file renamer with live dry-run preview (prefix, suffix, find/replace, numbering, extension, casing).
- [x] **Duplicate File Finder** (`duplicate-finder`) — Scan directories offline to detect duplicate files by size and SHA-256 hash matching.
- [x] **Folder Storage Analyzer** (`folder-analyzer`) — Visualize disk usage breakdowns by file category and locate largest files.
- [x] **File Checksum Verifier** (`checksum-verifier`) — Calculate SHA-256 / SHA-512 hashes and verify `.sha256sum` signature files.

## Documents & PDF (`documents`)

- [x] **PDF Preview** (`pdf-preview`) — Fast local page navigation, zoom, and document metrics via PDF.js.
- [x] **PDF Merger** (`pdf-merge`) — Combine multiple PDF files into one ordered document.
- [x] **PDF Splitter** (`pdf-split`) — Extract page ranges (`1-3, 7`) into separate PDF documents.
- [x] **PDF Rotator** (`pdf-rotate`) — Rotate selected pages (90°, 180°, 270°) stacking on existing rotation.
- [x] **PDF Optimizer** (`pdf-compress`) — Losslessly rewrite PDFs with compact object streams to shrink file size.
- [x] **PDF Page Reorderer** (`pdf-reorder`) — Reorganize pages into custom orders (`3, 1-2`) as a new PDF.
- [x] **PDF Page Numberer & Bates Stamper** (`pdf-numberer`) — Add sequential page numbering, total pages, and Bates stamps (`DOC-000001`) with custom positioning.
- [x] **PDF Watermarker & Stamp Applier** (`pdf-watermark`) — Stamp diagonal, centered, or tiled vector watermarks with custom opacity, angles, and colors.
- [x] **Markdown → PDF Exporter** (`markdown-to-pdf`) — Transform Markdown text, headings, code blocks, and lists into paginated vector PDF documents.
- [x] **Images → PDF** (`images-to-pdf`) — Combine JPG/PNG/WebP images into a single PDF document.
- [x] **PDF → Images** (`pdf-to-images`) — Render PDF pages into PNG/JPEG image files and package as a ZIP.
- [x] **PDF → Text** (`pdf-to-text`) — Extract the raw text layer with page-range filters to clipboard or `.txt`.
- [x] **Image OCR Extractor** (`image-ocr`) — Extract text from images, photos, scans, and receipts using offline Tesseract OCR.

## Images & Design (`images`)

- [x] **SVG & Vector Studio** (`svg-creator`) — Design vector shapes, graphics, and icons with live code generation, multi-layer styling, and multi-resolution PNG/WebP export.
- [x] **Image Palette Extractor** (`image-palette`) — Extract dominant color swatches using K-Means clustering with contrast ratios, hex/rgb/hsl, and CSS/Tailwind export.
- [x] **Image Slicer & Grid Splitter** (`image-slicer`) — Slice photos into 3x3 grids, 3x1 carousels, or custom rows/columns with instant ZIP export.
- [x] **Image Grid & Contact Sheet Builder** (`image-grid`) — Assemble multiple images into high-resolution photo contact sheets and collages.
- [x] **Gradient & Mesh Studio** (`gradient-studio`) — Create multi-stop linear, radial, and conic CSS & SVG gradients with visual angle controls.
- [x] **Image Preview** (`image-preview`) — Local image inspector with dimensions, byte size, and zoom controls.
- [x] **Image Converter** (`image-convert`) — Batch conversion between PNG, JPEG, WebP, AVIF, and TIFF with quality controls.
- [x] **Image Compressor** (`image-compress`) — Shrink image file sizes with quality adjustments and optional downscaling.
- [x] **EXIF Inspector** (`image-exif`) — Read camera, lens, exposure, capture date, and GPS coordinates offline.
- [x] **Image Watermarker** (`image-watermark`) — Stamp customizable text watermarks with position, opacity, and styling.
- [x] **Social Preset Resizer** (`social-resizer`) — Crop and resize images for social media platforms (OG cards, Instagram, YouTube, X, LinkedIn).

## Video (`video`)

- [x] **Video Converter** (`video-convert`) — Convert videos between MP4, WebM, and MKV via local FFmpeg.
- [x] **Video Compressor** (`video-compress`) — Shrink video file sizes with CRF quality presets and downscaling.
- [x] **Video → GIF** (`video-to-gif`) — Turn video clips into smooth animated GIFs with two-pass palette optimization.

## Audio (`audio`)

- [x] **Audio Waveform Trimmer** (`audio-trimmer`) — Interactive audio waveform visualizer and precision segment trimmer with fade in/out.
- [x] **Audio Loudness Normalizer** (`audio-normalize`) — Equalize audio volume to streaming standards (-14 LUFS Spotify, -16 LUFS Apple Music, EBU R128).
- [x] **Audio Extractor** (`extract-audio`) — Pull soundtracks from videos into AAC, MP3, WAV, FLAC, or Opus.
- [x] **Audio Converter** (`audio-convert`) — Convert audio tracks between MP3, AAC, WAV, FLAC, and Opus locally.

## Text, ASCII & Data (`text`)

- [x] **ASCII Art & Retro Banner Generator** (`ascii-banner`) — Generate retro terminal banners in multiple FIGlet-inspired fonts with customizable borders.
- [x] **Image → ASCII Art Converter** (`image-to-ascii`) — Convert images into high-contrast monochrome, ANSI terminal colored, or HTML ASCII art.
- [x] **ASCII & Unicode Table Generator** (`ascii-table`) — Turn CSV/TSV data into Markdown, Unicode Box, and terminal grid tables.
- [x] **XML ⇄ JSON Converter & Formatter** (`xml-json`) — Bidirectional XML ↔ JSON converter with attribute prefix customization and XML pretty-printing.
- [x] **Text Statistics & Readability Analyzer** (`text-analyzer`) — Calculate word/syllable counts, reading time, and Flesch-Kincaid reading ease scores.
- [x] **JSON Formatter** (`json-format`) — Pretty-print, minify, and validate JSON with precise error pointers.
- [x] **Base64 Encoder / Decoder** (`base64-codec`) — Encode and decode Base64 text with full UTF-8 Unicode support.
- [x] **Markdown Preview** (`markdown-preview`) — Live side-by-side Markdown rendering to sanitized HTML.
- [x] **YAML ⇄ JSON Converter** (`yaml-json`) — Bidirectional YAML ↔ JSON conversion with syntax validation.
- [x] **CSV ⇄ JSON Converter** (`csv-json`) — Convert CSV/TSV to JSON and back with RFC 4180 delimiter control.
- [x] **Text Diff** (`text-diff`) — Side-by-side and inline line comparison showing additions, deletions, and changes.
- [x] **Case Converter** (`text-cases`) — Transform text across camelCase, snake_case, kebab-case, PascalCase, and title case.
- [x] **HTML Entities & Slug** (`html-entities`) — Escape/unescape HTML entities and generate clean URL slugs.

## Developer & Security (`developer`)

- [x] **cURL Code Generator** (`curl-converter`) — Convert cURL commands into JavaScript fetch, Python requests, Node.js, Go, Rust, and PHP code snippets.
- [x] **JSON Schema Validator & Generator** (`json-schema`) — Infer Draft-07 JSON schemas from payload samples and validate JSON offline with pinpoint error indicators.
- [x] **Chmod & Unix Permission Calculator** (`chmod-calculator`) — Interactive visual permission matrix calculating octal, symbolic (`rwxr-xr-x`), binary, and command syntax.
- [x] **Cryptographic Keypair Generator** (`keypair-generator`) — Generate offline RSA (2048/4096), ECDSA (P-256/P-384/P-521), and Ed25519 public/private keys in SPKI/PKCS#8 PEM formats.
- [x] **SemVer Calculator & Range Tester** (`semver-calculator`) — Bump semantic versions (major, minor, patch, prerelease) and test caret/tilde/hyphen range satisfaction.
- [x] **QR Code Generator** (`qr-generator`) — Generate high-resolution scannable QR codes from text or URLs offline.
- [x] **QR Decoder** (`qr-decoder`) — Extract text payloads from QR code images offline.
- [x] **Passphrase Generator** (`passphrase-generator`) — Generate cryptographically secure diceware passphrases and passwords with entropy ratings.
- [x] **Regex Tester** (`regex-tester`) — Test regular expressions live with match highlighting, capture groups, and flags.
- [x] **JWT Decoder** (`jwt-decoder`) — Decode JSON Web Token headers and payloads with expiration status.
- [x] **Unix Timestamp Converter** (`timestamp-converter`) — Convert epoch timestamps to formatted ISO dates and local times.
- [x] **Hash Generator** (`hash-generator`) — Compute MD5, SHA-1, SHA-256, and SHA-512 digests for text or streamed files.
- [x] **URL Utilities** (`url-utils`) — Parse URLs into components (origin, pathname, query params) and percent-encode/decode.
- [x] **UUID Generator** (`uuid-generator`) — Generate version-4 UUIDs in bulk using the OS secure random source.
- [x] **SQL Formatter** (`sql-formatter`) — Beautify SQL queries offline with dialect selection and keyword casing.
- [x] **Cron Helper** (`cron-explainer`) — Plain-language cron expression explainer with upcoming run time predictions.
- [x] **MIME Type Lookup** (`mime-lookup`) — Search curated file extensions and MIME content-types.
- [x] **HTTP Status Codes** (`http-status`) — Browse HTTP response codes with categories and descriptions.
- [x] **Color Converter** (`color-converter`) — Convert HEX, RGB, and HSL, test WCAG contrast ratios, and generate palettes.
- [x] **JSON → TypeScript Types** (`json-to-types`) — Infer TypeScript interfaces and types from sample JSON payloads.
- [x] **Icon Pack Generator** (`icon-pack`) — Turn a single icon image into a full application icon bundle (9 PNG sizes + `favicon.ico`).

## AI-adjacent & Creative (`future`)

- [x] **Prompt Library** (`prompt-library`) — Manage local reusable prompt templates with `{{variable}}` substitution.
- [x] **Brand Bible Creator** (`brand-bible`) — Design exportable brand style guides with color palettes, typography, and rules.

## Product-level Platform Utilities

- [x] **Global Command Palette** (`Ctrl+K`) — Instant fuzzy search across all tools, descriptions, and tags.
- [x] **Batch Queue Runner & Builder** (`QueueView`) — Multi-tool pipeline execution with output-to-input chaining and validation.
- [x] **Usage Analytics Dashboard** (`UsageDashboard`) — Local SQLite-powered zero-latency metrics and charts.
- [x] **Favorites & Pinned Tools** — Quick-access workspace shortcuts in sidebar and header.
