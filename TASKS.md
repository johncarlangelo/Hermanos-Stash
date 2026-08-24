# Hermanos Stash — Task Board

Legend:

- `[ ]` not started
- `[-]` in progress
- `[x]` verified complete
- `[!]` blocked

## Milestone 1 — Foundation

### Project setup
- [x] Initialize Electron + React + TypeScript + Vite.
- [x] Establish main/preload/renderer boundaries.
- [x] Configure Tailwind CSS, CSS Modules, and design token integration.
- [x] Establish linting, formatting, and type checking.
- [x] Establish test framework.
- [x] Establish build/package workflow. *(electron-vite production build + electron-builder: win-unpacked build produced, FFmpeg binaries shipped via extraResources, packaged exe passes smoke boot)*

### Design system
- [x] Implement dark design tokens (guided by `DESIGN.md` and installed skills).
- [x] Implement typography scale.
- [x] Implement spacing/radius/elevation tokens.
- [x] Implement core controls (buttons, inputs, cards, drop zones, switches).
- [x] Implement focus/keyboard states.
- [x] Implement motion primitives.

### Application shell
- [x] Build persistent sidebar.
- [x] Build main content region.
- [x] Build tool navigation.
- [x] Build category navigation.
- [x] Build global search.
- [x] Build tag filtering. *(registry `byTag` tested; tags render on tool pages and palette results; clicking any tag opens search pre-seeded with that tag)*
- [x] Build favorites.
- [x] Build recent tools.
- [x] Build empty/error/loading states.

### Local platform
- [x] Secure filesystem bridge.
- [x] Native file picker.
- [x] Save/export dialog.
- [x] Temporary workspace manager & cleanup.
- [x] Progress event & cancellation IPC bridge.
- [x] Processor structured error normalization.
- [x] Local SQLite persistence.
- [x] Activity history service.
- [x] Notification/toast system.

## Milestone 2 — Demonstration tools

- [x] PDF preview.
- [x] Image preview.
- [x] JSON formatter/validator.
- [x] Image converter.
- [x] Image compressor.
- [x] PDF merger.
- [x] PDF splitter.
- [x] ZIP creator/extractor.
- [x] File metadata viewer.
- [x] Base64 encoder/decoder.
- [x] QR generator.

## Milestone 3 — Native Media & Heavy Processing

- [x] FFmpeg native integration & binary management. *(bundled-first resolution with PATH fallback, cached; spawn-based, no new deps)*
- [x] Large media streaming & background workers. *(spawned ffmpeg with `-progress pipe:1`, cooperative + instant-hook cancellation, stderr tails in structured errors)*
- [x] Output verification & integrity checks. *(every media output re-probed via ffprobe: container/stream kind + duration within ±10% before export)*
- [x] Media transcoding & audio extraction services.

## Milestone 4 — Expansion candidates

- [x] PDF page extraction. *(shipped as PDF Splitter in Milestone 2)*
- [x] PDF page reorder. *(pdf-reorder: explicit ordered sequence, duplicates rejected, new doc via pdf-lib page copy)*
- [x] PDF rotation. *(pdf-rotate: 'all' or sequence spec, cumulative mod-360 rotation, subset support)*
- [x] PDF compression. *(pdf-compress: lossless object-stream rewrite only; honest grew-larger reporting)*
- [x] Images → PDF. *(images-to-pdf: one natural-size full-bleed page per JPG/PNG, ordered queue)*
- [x] PDF → images. *(pdf-to-images: renderer-side pdf.js rendering, PNG/JPEG + quality + scale, ZIP via save dialog, between-page cancel)*
- [x] WebP tools. *(covered by Image Converter — WebP is a first-class encode target with quality control; a dedicated standalone tool adds nothing)*
- [x] EXIF viewer. *(image-exif: renderer-side exifr parse, curated grouped rows, GPS text-only + copy, honest empty state)*
- [x] Video converter.
- [x] Video compressor.
- [x] Video → GIF.
- [x] Audio extraction.
- [x] Audio converter.
- [x] Markdown preview. *(marked gfm/breaks + DOMPurify sanitize, live two-pane preview, Copy HTML)*
- [x] YAML ↔ JSON.
- [x] CSV ↔ JSON. *(hand-written strict RFC 4180 parser/serializer, header-row toggle, delimiter select)*
- [x] Text diff. *(LCS line diff, 2000-line guard, unified +/- rows)*
- [x] Regex tester. *(never-throws evaluator, dgimsuvy flags, zero-length safety, maxMatches sentinel, highlighted live preview)*
- [x] JWT decoder. *(base64url split/decode/parse with per-stage errors, exp status strip, explicit not-verified notice)*
- [x] Timestamp converter. *(s/ms auto-detect at >1e11, negatives allowed, live now card, datetime-local reverse row)*
- [x] Hash generator. *(crypto:hash-text/crypto:hash-file IPC via node:crypto, streamed file digests, history on file hashes)*
- [x] UUID generator. *(crypto.randomUUID v4, bulk 1–100, uppercase/braces options, format validation tests)*
- [x] URL utilities. *(component parser with https:// auto-prepend, URIError-safe encode/decode, query param list)*

## QA findings — pending revision

- [x] Drag-and-drop does not accept files in several file tools, while click-to-browse works fine. *(RESOLVED: root cause confirmed — Electron ≥ 32 removed `File.path` on dropped files, so `DropZone.filterValid()` always produced zero paths. Fixed by exposing `webUtils.getPathForFile(file)` through the preload bridge (`stash.files.getPathForFile`) and using it in DropZone — the documented Electron migration path. Verified end-to-end via `scripts/e2e-drag-probe.mjs`, which synthesizes a real OS-backed file drop over CDP onto the live UI and asserts the tool receives the absolute path.)*

## Quality of life improvements

- [x] Remember last output folder per tool (persisted in prefs, pre-fills folder pickers). *(shared `use-output-dir` hook over prefs `outDir:<toolId>`; adopted by the media scaffold (5 tools), image-convert, image-compress, pdf-split, zip-extract)*
- [x] "Open in Explorer" + copy-path actions on saved-output rows. *(new `shell:reveal-path` IPC + shared `RevealButton`/`CopyPathButton` wired into image/media/pdf-split result rows, all save-dialog summaries, zip-extract directory and qr-generator post-save state)*
- [x] Activity History page (list, filter by tool, navigate to tool; PRD §8 finally visible). *(HistoryView + sidebar nav; two-step confirm on clear here and in Settings)*
- [x] Zoom preference in Settings (100/110/125%, persisted, live-applied, titlebar adapts). *(`app:set-zoom` clamped via shared `utils/zoom.ts`, overlay height tracks 40 DIPs × factor on win32, startup reads `ui.zoom`, header sized from `env(titlebar-area-*)`)*
- [x] Drop-anywhere routing (drop on window background → matching tools suggested). *(`EXTENSION_TOOL_HINTS` registry-filtered map + DropRouter modal; per-tool zones unaffected — verified by e2e-drag-probe)*
- [x] Keyboard shortcuts (Esc → Home, Ctrl+1..5 → favorites). *(global handler, skipped while typing in fields)*
- [x] Option help hints. *(accessible `?` affordance on FieldRow — hover AND keyboard-focus tooltips — wired into video/audio/image/QR options explaining CRF, bitrates, error correction etc.)*
- [x] Per-tool history link. *(`HistoryView` accepts a seed tool id; tools that accept files show a quiet "History for this tool" link in their header)*

## Milestone 5 — Prompt library (`future` category)

- [x] Storage: `prompts` table (schema v2 migration) + PromptsStore CRUD with tests.
- [x] IPC surface: list/save/delete channels behind the typed bridge.
- [x] Tool UI: searchable list, create/edit/delete/duplicate, tag filtering.
- [x] Template variables: `{{variable}}` detection + fill-in-and-copy flow.
- [x] Starter pack + JSON import/export for backup.
- [x] Register `prompt-library` tool; update catalog docs and counts. *(34 tools at ship; restored to checked after a stale-copy regression during Milestone 6 doc edits)*

## Milestone 6 — Expansion round

### Wave A — quick wins
- [x] SQL Formatter (`sql-formatter`, mature `sql-formatter` lib).
- [x] Cron Explainer (parse + describe + next runs, `cron-parser` lib).
- [x] Case Converter & Counter (camel/snake/kebab/etc., word/char stats).
- [x] HTML Entities & Slug generator (segmented tool).
- [x] MIME Lookup (extension ⇄ type, searchable).
- [x] HTTP Status Reference (searchable cards).

### Wave B — file operations
- [x] Batch Rename: folder picker (write-scoped), transform rules (replace/prefix/suffix/numbering/case/extension), dry-run preview, apply. *(`fs:list-dir` + `files:batch-rename` channels; pure engine `shared/utils/rename-rules.ts` shared by renderer preview and main apply; every from/to re-validated inside the user-approved dir main-side; two-step confirm; 14 new engine tests)*

### Wave C — color & brand
- [x] Color Converter: HEX/RGB/HSL, contrast checker, shade/tint/harmony palettes. *(pure color engine `color-converter/logic` — tolerant parsing, round-trip-safe conversions, WCAG luminance/contrast/best-text, clamped shade scales, hue-wheel harmonies; 17 logic tests; live swatch preview with best-text sample, AA pass/fail badges as text, click-to-copy-and-load palettes)*
- [x] Brand Bible Creator: colors + auto palettes, typography pairing, voice keywords, dos/don'ts; Markdown/JSON export; draft autosave. *(numbered 01–05 panels; three color fields each with shade strip + AA-vs-white text badges; 12 system font pairings with live previews + computed type scale (1.200/1.250/1.333); deterministic `buildMarkdown`; autosave to prefs `draft:brand-bible` debounced 500 ms with two-step reset; Copy Markdown / Save Markdown… / Save JSON… via save dialog + writeTextFile; history on export; 12 logic tests)*

### Wave D — gap fillers
- [x] JSON → TypeScript types (`json-to-types`). *(pure generator `json-to-types/logic` — per-value type inference, all-keys superset merging for object arrays with optional-field detection, literal unions for short uniform string arrays, PascalCase nested naming with numeric dedup, reserved-word/digit sanitizing, JSON.parse error positions via `positionToLineColumn`; 15 logic tests; live two-pane UI with root name, interface/type style and optional-fields toggle)*
- [x] PDF → Text extraction (`pdf-to-text`, renderer-side pdf.js). *(shared pdfjs bootstrap reused; hasEOL-based `assembleText` with preserve/flow layout modes; page-range filtering via shared `parsePageSequence`; per-page aria-live progress; Copy + Save .txt via save dialog + writeTextFile; history records; 16 logic tests)*

### Wave E — completing stories
- [x] QR Decoder (`qr-decoder`, drop image → decoded text). *(renderer-side decode: readFileBytes → Blob → createImageBitmap → OffscreenCanvas with document-canvas fallback (feature-detected) → getImageData → jsQR; `pickDecoderCanvas`/`downscaleIfNeeded`/`extractResult` pure helpers with injected constructors, 11 logic tests; preview thumbnail + selectable mono result with Copy, URL payloads shown as copyable text with an honest "Stash doesn't open browsers" hint; no-QR-found styled as guidance, not failure; dimensions · size · decode-ms metadata; history on success; drop-routing hints for png/jpg/jpeg/webp/bmp)*
- [x] Passphrase Generator (`passphrase-generator`, words + passwords, strength meter). *(embedded 256-word list (3–7 letters, unique); rejection-sampled crypto.getRandomValues for words, digits, and Fisher–Yates password shuffles with ≥1 char per selected class; entropy = n·log2(256) or length·log2(alphabet), thresholds Weak<45≤Fair<60≤Strong<80≤Excellent; 13 logic tests incl. wordlist invariants and 50-iteration pattern checks; Passphrase/Password segmented modes, word count/separator/toggles, 8–64 slider with class toggles, labeled strength meter (never color-only) + bits caption; records nothing to history by design)*

### Wave F — creator pack
- [x] Image Watermarker (`image-watermark`, batch text stamp via sharp). *(`images:watermark-batch` on the shared job lifecycle — SVG text overlay composited via sharp, text sanitized 1–60 chars, 3×3 position grid, font size 12–144, hex color pair field + native picker, opacity 5–100%, per-file progress/cancel/collision-suffix export; 5 new processing tests incl. dimension preservation and color/opacity validation)*
- [x] Favicon / App-Icon Pack (`icon-pack`, one logo → full size set). *(renamed from "zipped" to loose-file export for fewer moving parts; `icons:generate-pack` derives a 512 center-crop master then writes icon-16…icon-512 plus favicon.ico built by a minimal pure-JS PNG-in-ICO container writer (22-byte header, Vista+ valid); cancel between sizes, fixed artifact names with collision suffixing; 4 tests incl. ICO header fields and favicon signature)*
- [x] Social Preset Resizer (`social-resizer`, file × preset batch smart crop). *(`social:resize-batch`; shared `PRESET_LIST` in `shared/utils/social-presets.ts` drives UI checkboxes and main-side validation; 8 presets — OG image, X card, Instagram square/portrait/story, YouTube thumb, LinkedIn, Facebook link; `sharp resize fit:'cover' position:'attention'`; outputs `<stem>-<presetId><ext>`, labeled rows like "photo.jpg · OG Image", per-item progress + cancel; preset-integrity and exact-dimension tests)*

## Future

- [x] Prompt template organizer. *(delivered as the Prompt Library tool, Milestone 5)*
- [x] Prompt formatter. *(template variables + fill-in flow in the Prompt Library)*
- [x] Prompt variable builder. *(`{{variable}}` detection and fill-in-and-copy in the Prompt Library)*
- [x] Local prompt history. *(prompts persisted in SQLite via the Prompt Library)*
- [ ] Additional tool categories discovered through real usage.
