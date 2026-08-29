# Hermanos Stash — Tool Catalog

This is a living catalog tracking shipped tools and candidates. Currently **51 tools** are implemented and registered across 8 categories.

## Files & Archives (`files`)
- [x] **File Metadata Viewer** (`file-metadata`) — Inspect size, dates, MIME type, and full path for any local file.
- [x] **ZIP Creator** (`zip-create`) — Pack any mix of files into a single `.zip` archive entirely locally.
- [x] **ZIP Extractor** (`zip-extract`) — Extract `.zip` archives into a target directory with zip-slip protection.
- [x] **Batch Rename** (`batch-rename`) — Multi-rule file renamer with live dry-run preview (prefix, suffix, find/replace, numbering, extension, casing).
- [ ] Archive inspector (tar, 7z, rar preview without full extraction)
- [ ] Duplicate filename / content hash finder
- [ ] Large file tree analyzer

## Documents & PDF (`documents`)
- [x] **PDF Preview** (`pdf-preview`) — Fast local page navigation, zoom, and document metrics via PDF.js.
- [x] **PDF Merger** (`pdf-merge`) — Combine multiple PDF files into one ordered document.
- [x] **PDF Splitter** (`pdf-split`) — Extract page ranges (`1-3, 7`) into separate PDF documents.
- [x] **PDF Rotator** (`pdf-rotate`) — Rotate selected pages (90°, 180°, 270°) stacking on existing rotation.
- [x] **PDF Optimizer** (`pdf-compress`) — Losslessly rewrite PDFs with compact object streams to shrink file size.
- [x] **PDF Page Reorderer** (`pdf-reorder`) — Reorganize pages into custom orders (`3, 1-2`) as a new PDF.
- [x] **Images → PDF** (`images-to-pdf`) — Combine JPG/PNG/WebP images into a single PDF document.
- [x] **PDF → Images** (`pdf-to-images`) — Render PDF pages into PNG/JPEG image files and package as a ZIP.
- [x] **PDF → Text** (`pdf-to-text`) — Extract the raw text layer with page-range filters to clipboard or `.txt`.
- [x] **Image OCR Extractor** (`image-ocr`) — Extract text from images, photos, scans, and receipts using offline Tesseract OCR.
- [ ] Document conversion (DOCX/ODT/Markdown → PDF)

## Images (`images`)
- [x] **Image Preview** (`image-preview`) — Local image inspector with dimensions, byte size, and zoom controls.
- [x] **Image Converter** (`image-convert`) — Batch conversion between PNG, JPEG, WebP, AVIF, and TIFF with quality controls.
- [x] **Image Compressor** (`image-compress`) — Shrink image file sizes with quality adjustments and optional downscaling.
- [x] **EXIF Inspector** (`image-exif`) — Read camera, lens, exposure, capture date, and GPS coordinates offline.
- [x] **Image Watermarker** (`image-watermark`) — Stamp customizable text watermarks with position, opacity, and styling.
- [x] **Social Preset Resizer** (`social-resizer`) — Crop and resize images for social media platforms (OG cards, Instagram, YouTube, X, LinkedIn).
- [ ] Contact sheet / image grid generator
- [ ] Image color quantization / palette extractor

## Video (`video`)
- [x] **Video Converter** (`video-convert`) — Convert videos between MP4, WebM, and MKV via local FFmpeg.
- [x] **Video Compressor** (`video-compress`) — Shrink video file sizes with CRF quality presets and downscaling.
- [x] **Video → GIF** (`video-to-gif`) — Turn video clips into smooth animated GIFs with two-pass palette optimization.
- [ ] Video trimmer / visual clip cutter
- [ ] Video frame extractor (extract frames at interval / timestamp)

## Audio (`audio`)
- [x] **Audio Extractor** (`extract-audio`) — Pull soundtracks from videos into AAC, MP3, WAV, FLAC, or Opus.
- [x] **Audio Converter** (`audio-convert`) — Convert audio tracks between MP3, AAC, WAV, FLAC, and Opus locally.
- [ ] Audio trimmer / visual waveform cutter
- [ ] Audio volume normalizer / loudness equalizer

## Text & Data (`text`)
- [x] **JSON Formatter** (`json-format`) — Pretty-print, minify, and validate JSON with precise error pointers.
- [x] **Base64 Encoder / Decoder** (`base64-codec`) — Encode and decode Base64 text with full UTF-8 Unicode support.
- [x] **Markdown Preview** (`markdown-preview`) — Live side-by-side Markdown rendering to sanitized HTML.
- [x] **YAML ⇄ JSON Converter** (`yaml-json`) — Bidirectional YAML ↔ JSON conversion with syntax validation.
- [x] **CSV ⇄ JSON Converter** (`csv-json`) — Convert CSV/TSV to JSON and back with RFC 4180 delimiter control.
- [x] **Text Diff** (`text-diff`) — Side-by-side and inline line comparison showing additions, deletions, and changes.
- [x] **Case Converter** (`text-cases`) — Transform text across camelCase, snake_case, kebab-case, PascalCase, and title case.
- [x] **HTML Entities & Slug** (`html-entities`) — Escape/unescape HTML entities and generate clean URL slugs.
- [ ] XML formatter & validator
- [ ] JSON schema validator

## Developer (`developer`)
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
- [ ] User-Agent string parser

## AI-adjacent & Creative (`future`)
- [x] **Prompt Library** (`prompt-library`) — Manage local reusable prompt templates with `{{variable}}` substitution.
- [x] **Brand Bible Creator** (`brand-bible`) — Design exportable brand style guides with color palettes, typography, and rules.
- [ ] Local prompt comparator / diff

## Product-level Platform Utilities
- [x] **Global Command Palette** (`Ctrl+K`) — Instant fuzzy search across all tools, descriptions, and tags.
- [x] **Batch Queue Runner & Builder** (`QueueView`) — Multi-tool pipeline execution with output-to-input chaining and validation.
- [x] **Usage Analytics Dashboard** (`UsageDashboard`) — Local SQLite-powered zero-latency metrics and charts.
- [x] **Favorites & Pinned Tools** — Quick-access workspace shortcuts in sidebar and header.
- [x] **Activity History** — SQLite persisted audit log of past tool operations.
- [x] **Settings & Profile Portability** — Export and import `.stash-profile` configuration bundles.
- [x] **Accent Themes** — 5 curated dark theme accent palettes (Amber, Emerald, Cyan, Violet, Rose).
