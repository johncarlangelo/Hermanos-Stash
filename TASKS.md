# Hermanos Stash â€” Task Board

Legend:

- `[ ]` not started
- `[-]` in progress
- `[x]` verified complete
- `[!]` blocked

## Milestone 1 â€” Foundation

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

## Milestone 2 â€” Demonstration tools

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

## Milestone 3 â€” Native Media & Heavy Processing

- [x] FFmpeg native integration & binary management. *(bundled-first resolution with PATH fallback, cached; spawn-based, no new deps)*
- [x] Large media streaming & background workers. *(spawned ffmpeg with `-progress pipe:1`, cooperative + instant-hook cancellation, stderr tails in structured errors)*
- [x] Output verification & integrity checks. *(every media output re-probed via ffprobe: container/stream kind + duration within Â±10% before export)*
- [x] Media transcoding & audio extraction services.

## Milestone 4 â€” Expansion candidates

- [x] PDF page extraction. *(shipped as PDF Splitter in Milestone 2)*
- [x] PDF page reorder. *(pdf-reorder: explicit ordered sequence, duplicates rejected, new doc via pdf-lib page copy)*
- [x] PDF rotation. *(pdf-rotate: 'all' or sequence spec, cumulative mod-360 rotation, subset support)*
- [x] PDF compression. *(pdf-compress: lossless object-stream rewrite only; honest grew-larger reporting)*
- [x] Images â†’ PDF. *(images-to-pdf: one natural-size full-bleed page per JPG/PNG, ordered queue)*
- [x] PDF â†’ images. *(pdf-to-images: renderer-side pdf.js rendering, PNG/JPEG + quality + scale, ZIP via save dialog, between-page cancel)*
- [x] WebP tools. *(covered by Image Converter â€” WebP is a first-class encode target with quality control; a dedicated standalone tool adds nothing)*
- [x] EXIF viewer. *(image-exif: renderer-side exifr parse, curated grouped rows, GPS text-only + copy, honest empty state)*
- [x] Video converter.
- [x] Video compressor.
- [x] Video â†’ GIF.
- [x] Audio extraction.
- [x] Audio converter.
- [x] Markdown preview. *(marked gfm/breaks + DOMPurify sanitize, live two-pane preview, Copy HTML)*
- [x] YAML â†” JSON.
- [x] CSV â†” JSON. *(hand-written strict RFC 4180 parser/serializer, header-row toggle, delimiter select)*
- [x] Text diff. *(LCS line diff, 2000-line guard, unified +/- rows)*
- [x] Regex tester. *(never-throws evaluator, dgimsuvy flags, zero-length safety, maxMatches sentinel, highlighted live preview)*
- [x] JWT decoder. *(base64url split/decode/parse with per-stage errors, exp status strip, explicit not-verified notice)*
- [x] Timestamp converter. *(s/ms auto-detect at >1e11, negatives allowed, live now card, datetime-local reverse row)*
- [x] Hash generator. *(crypto:hash-text/crypto:hash-file IPC via node:crypto, streamed file digests, history on file hashes)*
- [x] UUID generator. *(crypto.randomUUID v4, bulk 1â€“100, uppercase/braces options, format validation tests)*
- [x] URL utilities. *(component parser with https:// auto-prepend, URIError-safe encode/decode, query param list)*

## QA findings â€” pending revision

- [x] Drag-and-drop does not accept files in several file tools, while click-to-browse works fine. *(RESOLVED: root cause confirmed â€” Electron â‰¥ 32 removed `File.path` on dropped files, so `DropZone.filterValid()` always produced zero paths. Fixed by exposing `webUtils.getPathForFile(file)` through the preload bridge (`stash.files.getPathForFile`) and using it in DropZone â€” the documented Electron migration path. Verified end-to-end via `scripts/e2e-drag-probe.mjs`, which synthesizes a real OS-backed file drop over CDP onto the live UI and asserts the tool receives the absolute path.)*

## Quality of life improvements

- [x] Remember last output folder per tool (persisted in prefs, pre-fills folder pickers). *(shared `use-output-dir` hook over prefs `outDir:<toolId>`; adopted by the media scaffold (5 tools), image-convert, image-compress, pdf-split, zip-extract)*
- [x] "Open in Explorer" + copy-path actions on saved-output rows. *(new `shell:reveal-path` IPC + shared `RevealButton`/`CopyPathButton` wired into image/media/pdf-split result rows, all save-dialog summaries, zip-extract directory and qr-generator post-save state)*
- [x] Activity History page (list, filter by tool, navigate to tool; PRD Â§8 finally visible). *(HistoryView + sidebar nav; two-step confirm on clear here and in Settings)*
- [x] Zoom preference in Settings (100/110/125%, persisted, live-applied, titlebar adapts). *(`app:set-zoom` clamped via shared `utils/zoom.ts`, overlay height tracks 40 DIPs Ã— factor on win32, startup reads `ui.zoom`, header sized from `env(titlebar-area-*)`)*
- [x] Drop-anywhere routing (drop on window background â†’ matching tools suggested). *(`EXTENSION_TOOL_HINTS` registry-filtered map + DropRouter modal; per-tool zones unaffected â€” verified by e2e-drag-probe)*
- [x] Keyboard shortcuts (Esc â†’ Home, Ctrl+1..5 â†’ favorites). *(global handler, skipped while typing in fields)*
- [x] Option help hints. *(accessible `?` affordance on FieldRow â€” hover AND keyboard-focus tooltips â€” wired into video/audio/image/QR options explaining CRF, bitrates, error correction etc.)*
- [x] Per-tool history link. *(`HistoryView` accepts a seed tool id; tools that accept files show a quiet "History for this tool" link in their header)*

## Milestone 5 â€” Prompt library (`future` category)

- [x] Storage: `prompts` table (schema v2 migration) + PromptsStore CRUD with tests.
- [x] IPC surface: list/save/delete channels behind the typed bridge.
- [x] Tool UI: searchable list, create/edit/delete/duplicate, tag filtering.
- [x] Template variables: `{{variable}}` detection + fill-in-and-copy flow.
- [x] Starter pack + JSON import/export for backup.
- [x] Register `prompt-library` tool; update catalog docs and counts. *(34 tools at ship; restored to checked after a stale-copy regression during Milestone 6 doc edits)*

## Milestone 6 â€” Expansion round

### Wave A â€” quick wins
- [x] SQL Formatter (`sql-formatter`, mature `sql-formatter` lib).
- [x] Cron Explainer (parse + describe + next runs, `cron-parser` lib).
- [x] Case Converter & Counter (camel/snake/kebab/etc., word/char stats).
- [x] HTML Entities & Slug generator (segmented tool).
- [x] MIME Lookup (extension â‡„ type, searchable).
- [x] HTTP Status Reference (searchable cards).

### Wave B â€” file operations
- [x] Batch Rename: folder picker (write-scoped), transform rules (replace/prefix/suffix/numbering/case/extension), dry-run preview, apply. *(`fs:list-dir` + `files:batch-rename` channels; pure engine `shared/utils/rename-rules.ts` shared by renderer preview and main apply; every from/to re-validated inside the user-approved dir main-side; two-step confirm; 14 new engine tests)*

### Wave C â€” color & brand
- [x] Color Converter: HEX/RGB/HSL, contrast checker, shade/tint/harmony palettes. *(pure color engine `color-converter/logic` â€” tolerant parsing, round-trip-safe conversions, WCAG luminance/contrast/best-text, clamped shade scales, hue-wheel harmonies; 17 logic tests; live swatch preview with best-text sample, AA pass/fail badges as text, click-to-copy-and-load palettes)*
- [x] Brand Bible Creator: colors + auto palettes, typography pairing, voice keywords, dos/don'ts; Markdown/JSON export; draft autosave. *(numbered 01â€“05 panels; three color fields each with shade strip + AA-vs-white text badges; 12 system font pairings with live previews + computed type scale (1.200/1.250/1.333); deterministic `buildMarkdown`; autosave to prefs `draft:brand-bible` debounced 500 ms with two-step reset; Copy Markdown / Save Markdownâ€¦ / Save JSONâ€¦ via save dialog + writeTextFile; history on export; 12 logic tests)*

### Wave D â€” gap fillers
- [x] JSON â†’ TypeScript types (`json-to-types`). *(pure generator `json-to-types/logic` â€” per-value type inference, all-keys superset merging for object arrays with optional-field detection, literal unions for short uniform string arrays, PascalCase nested naming with numeric dedup, reserved-word/digit sanitizing, JSON.parse error positions via `positionToLineColumn`; 15 logic tests; live two-pane UI with root name, interface/type style and optional-fields toggle)*
- [x] PDF â†’ Text extraction (`pdf-to-text`, renderer-side pdf.js). *(shared pdfjs bootstrap reused; hasEOL-based `assembleText` with preserve/flow layout modes; page-range filtering via shared `parsePageSequence`; per-page aria-live progress; Copy + Save .txt via save dialog + writeTextFile; history records; 16 logic tests)*

### Wave E â€” completing stories
- [x] QR Decoder (`qr-decoder`, drop image â†’ decoded text). *(renderer-side decode: readFileBytes â†’ Blob â†’ createImageBitmap â†’ OffscreenCanvas with document-canvas fallback (feature-detected) â†’ getImageData â†’ jsQR; `pickDecoderCanvas`/`downscaleIfNeeded`/`extractResult` pure helpers with injected constructors, 11 logic tests; preview thumbnail + selectable mono result with Copy, URL payloads shown as copyable text with an honest "Stash doesn't open browsers" hint; no-QR-found styled as guidance, not failure; dimensions Â· size Â· decode-ms metadata; history on success; drop-routing hints for png/jpg/jpeg/webp/bmp)*
- [x] Passphrase Generator (`passphrase-generator`, words + passwords, strength meter). *(embedded 256-word list (3â€“7 letters, unique); rejection-sampled crypto.getRandomValues for words, digits, and Fisherâ€“Yates password shuffles with â‰¥1 char per selected class; entropy = nÂ·log2(256) or lengthÂ·log2(alphabet), thresholds Weak<45â‰¤Fair<60â‰¤Strong<80â‰¤Excellent; 13 logic tests incl. wordlist invariants and 50-iteration pattern checks; Passphrase/Password segmented modes, word count/separator/toggles, 8â€“64 slider with class toggles, labeled strength meter (never color-only) + bits caption; records nothing to history by design)*

### Wave F â€” creator pack
- [x] Image Watermarker (`image-watermark`, batch text stamp via sharp). *(`images:watermark-batch` on the shared job lifecycle â€” SVG text overlay composited via sharp, text sanitized 1â€“60 chars, 3Ã—3 position grid, font size 12â€“144, hex color pair field + native picker, opacity 5â€“100%, per-file progress/cancel/collision-suffix export; 5 new processing tests incl. dimension preservation and color/opacity validation)*
- [x] Favicon / App-Icon Pack (`icon-pack`, one logo â†’ full size set). *(renamed from "zipped" to loose-file export for fewer moving parts; `icons:generate-pack` derives a 512 center-crop master then writes icon-16â€¦icon-512 plus favicon.ico built by a minimal pure-JS PNG-in-ICO container writer (22-byte header, Vista+ valid); cancel between sizes, fixed artifact names with collision suffixing; 4 tests incl. ICO header fields and favicon signature)*
- [x] Social Preset Resizer (`social-resizer`, file Ã— preset batch smart crop). *(`social:resize-batch`; shared `PRESET_LIST` in `shared/utils/social-presets.ts` drives UI checkboxes and main-side validation; 8 presets â€” OG image, X card, Instagram square/portrait/story, YouTube thumb, LinkedIn, Facebook link; `sharp resize fit:'cover' position:'attention'`; outputs `<stem>-<presetId><ext>`, labeled rows like "photo.jpg Â· OG Image", per-item progress + cancel; preset-integrity and exact-dimension tests)*

## Milestone 7 — shadcn/ui adoption *(planned from user QA feedback)*

**Goal:** replace clunky native-feeling controls with shadcn/ui (Radix-based)
components while keeping DESIGN.md's charcoal identity and a user-chosen
accent color.

- [x] Init: shadcn in Tailwind v4 mode (`components.json`, `cn()` helper,
      radix-ui + cva + clsx + tailwind-merge); semantic variables
      (`--background/--primary/--popover/--ring/…`) mapped onto Stash tokens
      in `global.css` so components inherit the charcoal look — NOT default zinc.
      `@` renderer alias added to tsconfig + electron-vite for the CLI.
- [x] **Accent theme picker (user request — dark-only stays):** Settings →
  Appearance accent selector shipped:
  - curated presets (amber default, sage, steel blue, rose, violet, teal) AND a free color picker;
  - pure derivation engine `features/settings/accent-theme.ts` computes hover shade, soft tint
    (`accent-soft` alpha blend) and label contrast (black/white by WCAG luminance via the
    color-converter engine) — 15 logic tests;
  - runtime CSS-variable override on `--color-accent*`; persisted via prefs `ui.accent`;
    applied pre-paint on startup from `main.tsx` (same slot as `ui.zoom`);
  - contrast guard: inline warning when a picked accent falls below ~3:1 against `--color-base`
    (every preset verified above threshold by test);
  - hardcoded accent literals removed from Button etc. — all consume derived variables.
- [x] Migrate behavior-critical controls: Select → Radix Select as a drop-in
  keeping the legacy `value/onChange/<option>` API (23 call sites, zero call-site edits);
  Dialog primitives in `Overlays.tsx` + DropRouter modal ported; FieldRow hint tooltip →
  Radix Tooltip (portal + collision-aware, hover AND keyboard focus). DropdownMenu/ScrollArea
  deferred until a call site exists (scope discipline).
- [x] Rebuild command palette on `cmdk` (registry fuzzy scoring retained as ranker;
  focus capture/arrows/Esc from cmdk; favorites group preserved).
- [x] Reconcile existing primitives: DropZone kept (bespoke); Button rebuilt on shadcn cva
  architecture while preserving the legacy primary/danger/sm/md/loading API so all 50 tools
  compile unchanged; Select/Input/Toggle visuals unchanged.
- [x] Sweep: typecheck 0 errors · build green · 568 tests passing (51 files) at every commit.
  VERIFICATION_LOG updated with per-item evidence. Human visual QA of the running app remains
  open for the user (release gate).

## Milestone 8 — UX polish round *(planned post-overhaul, from launcher-pattern research)*

**Goal:** launcher-grade multi-tool navigation and interaction polish (Raycast /
PowerToys Command Palette patterns). Plan: `.hermes/plans/2026-08-25_170000-ux-polish-round.md`.
Build on a fresh `ux-polish` branch; commit per feature; merge after review.

- [ ] Quick-Switch (`Ctrl+Tab`): overlay cycling the last 8 used tools, `Shift+Tab` reverses; keyboard-only. *(quickswitch store slice + overlay component; falls back to `Ctrl+Q` if the WebView eats the chord)*
- [ ] Toast polish: adopt `sonner` behind the existing `toastSuccess/toastError` API (14 tool files untouched) — glass cards, stacking depth, swipe-dismiss, pause-on-hover.
- [ ] Tool pinning: ordered `pinnedTools` pref, `PINNED` sidebar dock section with up/down reordering (drag-reorder deferred).
- [ ] Command palette preview pane: arrow-key selection shows a glass preview (description, tags, last-used); `Ctrl+Enter` opens in background (records recent, pre-warms the lazy chunk).
- [ ] Density preference: Settings → Appearance segmented control (`comfortable | compact`), `ui.density` pref applied pre-paint; scales renderer content only, never the titlebar chrome.
- [ ] Empty-state storytelling: contextual guidance per empty state (no favorites → "Star a tool…", no recents, zero-tool categories with nearest-category suggestions).
- [ ] Micro-interaction pass: advanced media options folded into Collapsibles, stagger-in batch result rows, DropZone success pulse, animated sidebar count badges.
- [ ] First-run coach marks: max 3 one-time hints (Ctrl+K, drop-anywhere, pinning); `onboarding.done` pref; never re-shown.

### Decisions pending user
- Quick-Switch source: last 8 recents (recommended) vs favorites.
- Palette preview: on-selection only (recommended) vs always-visible split.
- Pin limit: 6 (recommended) vs unlimited scroll.

### Out of scope (recorded)
- Global summon hotkey (main-process + OS registration — own milestone).
- Drag-to-reorder pins (dnd-kit; up/down buttons suffice for v1).
- Light theme (dark-only stays per product constraint).

## Milestone 8 — UX polish round *(launcher-grade interaction, post-overhaul)*

**Goal:** push the shell to launcher-grade quality (Raycast/PowerToys tier) for a 50-tool
app. Full spec: `.hermes/plans/2026-08-25_170000-ux-polish-round.md`. Build order =
dependency order below; each feature = own commit series on `ux-polish` branch.

- [x] **Toasts → sonner** (shadcn-standard): glass cards, swipe-dismiss, pause-on-hover.
      Keep `toastSuccess/toastError` API identical so tool call sites don't change. *(custom
      ToastViewport removed; Toaster themed to tokens, mounted in App)*
- [x] **Quick-Switch `Ctrl+Tab`**: overlay cycling last ~8 recents (Alt-Tab for tools);
      `Shift+Tab` reverses; keyboard-only. Fallback `Ctrl+Q` if Windows blocks the chord.
      *(`QuickSwitch.tsx`; capture-phase listeners, release-Ctrl-to-jump, starts on 2nd-most-recent)*
- [x] **Pinned tools dock**: ordered `pinnedTools` pref, PINNED sidebar section above
      Favorites, up/down reorder buttons (drag-reorder deferred). *(stores/pins.ts + 8 vitest
      tests incl. cap enforcement and optimistic-write-on-failure; pin/unpin button on tool pages)*
- [x] **Command palette upgrades**: right-side glass preview card on arrow-key selection
      (description/tags/last-used); `Ctrl+Enter` open-in-background (pre-warms lazy chunk via
      preload(), records recent, stays put). *(two-pane palette, capabilities chips)*
- [x] **Density preference**: Comfortable/Compact segmented control in Settings →
      Appearance; `ui.density` pref applied pre-paint; scales renderer content only,
      never titlebar chrome. *(radio-group control; `html[data-density=compact]` CSS block;
      skipped ToggleGroup — plain buttons match the shell better and avoid an extra adoption)*
- [x] **Empty-state storytelling**: contextual guidance per state (no favorites → star hint
      with Ctrl K kbd; empty category → three suggested tools from other categories as chips).
- [x] **Micro-interaction pass**: stagger-in batch result rows (30ms/row, capped 300ms);
      DropZone accepted-file pulse (ok-color border flash, 550ms). Advanced-options folding
      already covered by Collapsible adoption in the overhaul.
- [x] **First-run coach marks**: single dismissible strip with 3 hints (Ctrl+K, drop-anywhere,
      pinning); prefs `onboarding.done`; never re-shown after dismissal.

**Component adoptions riding along:** sonner, ToggleGroup, shadcn Breadcrumb
(replace hand-rolled breadcrumb in App.tsx). Everything else in the current
inventory already has call sites — nothing adopted without one (scope discipline).

**Deferred / out of scope:** global summon hotkey (main-process OS work, its own
milestone), drag-to-reorder pins (dnd-kit, v2), themes beyond accent (dark-only stays).

## Future

- [x] Prompt template organizer. *(delivered as the Prompt Library tool, Milestone 5)*
- [x] Prompt formatter. *(template variables + fill-in flow in the Prompt Library)*
- [x] Prompt variable builder. *(`{{variable}}` detection and fill-in-and-copy in the Prompt Library)*
- [x] Local prompt history. *(prompts persisted in SQLite via the Prompt Library)*
- [ ] Additional tool categories discovered through real usage.

## Milestone 9 — Batch Queue Runner + Usage Dashboard

**Goal:** automation depth (queue chaining) + self-awareness (usage insights) for the
launcher-grade shell. Full spec: `.hermes/plans/2026-08-26_140000-milestone-9-queue-dashboard.md`.

- [x] **Queue capability validation** (shared, tested): capability graph check before run (`src/shared/utils/queue-validation.ts`, 13/13 vitest tests pass).
- [x] **Queue Runner core** (renderer + main IPC): sequential execution, output→input piping, per-step progress tracking and cancellation (`src/renderer/features/shell/QueueRunner.tsx`).
- [x] **Queue Builder UI**: ordered step list, drag/reorder, per-step params, preset CRUD, live chain validation with tool compatibility filtering (`src/renderer/features/shell/QueueBuilder.tsx`).
- [x] **Queue presets persistence**: `queue.presets[]` in prefs, load/save/delete/lastUsed via Zustand store (`src/renderer/stores/queue.ts`, 8/8 vitest tests pass).
- [x] **Usage Dashboard UI**: reads SQLite activity/recents, Recharts metrics cards, top tools bar chart, category donut, status split, and drill-down tool explorer (`src/renderer/features/shell/UsageDashboard.tsx`).
- [x] **Sidebar integration**: "Queue" + "Insights" sections in persistent sidebar navigation, routed in `App.tsx` and `nav.ts` with breadcrumb support.
- [x] **Settings/Profile export**: export/import `.stash-profile` JSON bundles covering user preferences, queue presets, prompt library, favorites, and pinned tools (`src/renderer/features/shell/SettingsView.tsx`).

### Out of scope (recorded)
- Scheduled/recurring queues (cron — own milestone)
- Conditional branching (if fail → X else Y — v2)
- Queue sharing via URL/QR (v2)

## Tool #51 — Image OCR Extractor (`image-ocr`)

**Goal:** extract editable text from images, photos, scans, and screenshots locally and offline using Tesseract OCR.

- [x] **Tesseract OCR Processor (`src/main/processing/ocr.ts`)**: offline `tessdata` resolution (`resources/tessdata/eng.traineddata.gz`), Sharp grayscale/contrast/binarization preprocessing, progress reporting, and cancellation.
- [x] **OCR IPC Channel (`src/shared/ipc.ts`, `src/main/ipc/register.ts`, `src/preload/index.ts`)**: `images:ocr` IPC channel exposing `window.stash.processing.ocrImage`.
- [x] **Pure Logic & Unit Tests (`src/renderer/tools/image-ocr/logic.ts`, `logic.test.ts`)**: text stats calculation (words, characters, lines, paragraphs), confidence rating labels, text cleanup routines (13/13 tests pass).
- [x] **Tool View & UX (`src/renderer/tools/image-ocr/ImageOcrTool.tsx`)**: image preview with dimensions/size, PSM layout mode selector, preprocessing toggles, progress bar, formatted text output with word/char counters, confidence score badge, Copy Text, and Save as `.txt` file export.
- [x] **Tool Registration (`src/renderer/tools/index.ts`)**: registered in registry and lazy components with capabilities `{ acceptsFiles: true, producesText: true, supportsProgress: true }` under `documents` category (51 tools total).

## Tool #52 — Archive Inspector (`archive-inspect`)

**Goal:** inspect, search, and preview files inside archives in-memory without extracting them to disk, with password protection support.

- [x] **Archive Inspector Engine (`src/main/processing/archive-inspector.ts`, `archive-inspector.test.ts`)**: entry tree traversal via `unzipper` and `JSZip` fallback, memory-only stream buffers, password-protected archive decryption, and single-file extraction (5/5 unit tests pass).
- [x] **Archive IPC Channels (`src/shared/ipc.ts`, `src/main/ipc/register.ts`, `src/preload/index.ts`)**: `archivesInspect`, `archivesReadEntry`, and `archivesExtractEntry` channels exposing `window.stash.archives.inspect`, `readEntry`, and `extractEntry`.
- [x] **Pure Logic & Unit Tests (`src/renderer/tools/archive-inspect/logic.ts`, `logic.test.ts`)**: extension categorization, compression ratio calculation, search/category filtering, and MIME type guessing (16/16 unit tests pass).
- [x] **Tool View & UX (`src/renderer/tools/archive-inspect/ArchiveInspectTool.tsx`)**: interactive file explorer, category tabs (Images, Videos, Audio, Code/Text, PDFs), password unlock prompt, live in-memory previews with zoom/player controls, and 1-click single-file extract.
- [x] **Tool Registration & Documentation (`src/renderer/tools/index.ts`, `TOOL_CATALOG.md`, `PROGRESS.md`, `DECISIONS.md`)**: registered with capabilities `{ acceptsFiles: true, producesFiles: true }` under `files` category (52 tools total).

## Milestone 10 — 22-Tool Workstation Suite Expansion (75 Total Tools)

**Goal:** Add a comprehensive suite of local-first utilities across ASCII, Text/Data, Developer/Security, Images/Design, Documents/PDF, and Storage/Audio.

- [x] **Phase 1: ASCII & Retro Terminal Tools Suite**
  - [x] `ascii-banner` (ASCII Art & Retro Banner Generator) — FIGlet-style standard/slant/block fonts, custom borders, letter spacing.
  - [x] `image-to-ascii` (Image → ASCII Art Converter) — Custom character sets, inverted mode, ANSI terminal & HTML export.
  - [x] `ascii-table` (ASCII & Unicode Table Generator) — Markdown, Unicode single/double/rounded borders, column alignment, CSV/TSV parsing.
- [x] **Phase 2: Text & Data Utilities**
  - [x] `xml-json` (XML ⇄ JSON Converter & Formatter) — Pure bidirectional converter, attribute prefixes, pretty-printing.
  - [x] `text-analyzer` (Text Statistics & Readability Analyzer) — Syllable counting, Flesch Reading Ease, reading/speaking time, keywords.
- [x] **Phase 3: Developer & Security Utilities**
  - [x] `curl-converter` (cURL ⇄ Multi-Language Code Generator) — Fetch, Python, Go, Rust, PHP, Node.js code generation.
  - [x] `json-schema` (JSON Schema Validator & Generator) — Draft-07 inference from sample JSON and offline validation.
  - [x] `chmod-calculator` (Chmod & Unix Permission Calculator) — Interactive permission grid, octal/symbolic/binary, sticky/SUID/SGID.
  - [x] `keypair-generator` (Cryptographic Keypair Generator) — RSA (2048/4096), ECDSA, Ed25519 in SPKI/PKCS#8 PEM formats.
  - [x] `semver-calculator` (SemVer Calculator & Range Tester) — Major/minor/patch/prerelease bumping, caret/tilde range matching.
- [x] **Phase 4: Image & Design Studio**
  - [x] `image-palette` (Image Color Palette Extractor) — K-Means dominant color extraction, WCAG contrast, CSS variables, Tailwind swatches.
  - [x] `image-slicer` (Image Slicer & Grid Splitter) — 3x3 Instagram grids, 3x1 carousels, batch ZIP export.
  - [x] `image-grid` (Contact Sheet & Collage Grid Builder) — High-res contact sheets, configurable gutters, margins, and captions.
  - [x] `gradient-studio` (CSS & Vector Gradient Studio) — Linear, radial, and conic gradients with color stops and SVG/CSS code export.
- [x] **Phase 5: Documents & PDF Processing**
  - [x] `pdf-numberer` (PDF Page Numberer & Bates Stamper) — Sequential page numbering, Bates numbering, 6-cell positioning.
  - [x] `pdf-watermark` (PDF Watermarker & Stamp Applier) — Diagonal and tiled vector watermarks with rotation, opacity, and color picker.
  - [x] `markdown-to-pdf` (Markdown → PDF Document Exporter) — Markdown parsing into paginated vector PDF documents.
- [x] **Phase 6: Files, Storage & Audio Utilities**
  - [x] `duplicate-finder` (Duplicate File & Hash Matcher) — Fast size bucketing, WebCrypto SHA-256 matching, recoverable space calculation.
  - [x] `folder-analyzer` (Folder Storage Analyzer) — Category breakdown, disk space distribution bar, top largest files.
  - [x] `checksum-verifier` (File Checksum Signature Verifier) — SHA-256/512/1 hash calculation and `.sha256sum` signature verification.
  - [x] `audio-trimmer` (Audio Waveform Visualizer & Trimmer) — Web Audio peak extraction, interactive waveform scrubbing, WAV encoding.
  - [x] `audio-normalize` (Audio Loudness Normalizer) — Streaming target loudness normalization (-14 LUFS, Apple Music, EBU R128).

## Milestone 10.5 — Dual-Tool Split-Screen Workspace

**Goal:** Allow users to run any two tools from the 75-tool catalog side-by-side inside the single application window with interactive resizing and in-pane quick tool switching.

- [x] **Workspace Store Extension (`src/renderer/stores/workspace.ts`, `workspace.test.ts`)**: `splitMode`, `secondaryToolId`, `splitRatio` (clamped 0.25–0.75, persisted to local SQLite prefs under `ui.splitRatio`), `activePane`, `swapPanes`, `setSplitRatio` (8/8 vitest tests pass).
- [x] **Tool Quick Picker Modal (`src/renderer/features/shell/ToolQuickPicker.tsx`)**: searchable and categorizable tool selection dialog based on Radix Dialog for switching tools in either pane.
- [x] **Tool Page Embedded Layout Support (`src/renderer/features/shell/ToolPage.tsx`)**: added `embedded?: boolean` prop to omit hero headers in split view, and added split view toggle button (`Columns2`) to the tool hero action cluster.
- [x] **Dual Tool Workspace Container (`src/renderer/features/shell/DualToolWorkspace.tsx`)**: draggable resizer divider with visual grab handle, double-click reset to 50/50, keyboard arrow accessibility (`role="separator"`), compact pane titlebars with quick switcher, swap panes (`⇄`), maximize pane (`⤢`), and close split (`✕`).
- [x] **App Integration & Shortcuts (`src/renderer/app/App.tsx`)**: added persistent titlebar split screen button in the frameless window header, global `Ctrl + \` / `Cmd + \` keyboard shortcut, and independent pane scrolling.

## Tool #76 — ID & Passport Photo Studio (`id-photo-maker`)

**Goal:** Provide an automated 1x1, 2x2, and passport photo scaler, biometric portrait framer, and printable sheet maker with cutting guides and multi-format export (PDF, Word DOCX, 300 DPI PNG, Direct Print).

- [x] **Pure Sizing & Sheet Packing Engine (`src/renderer/tools/id-photo-maker/logic.ts`, `logic.test.ts`)**: Exact millimeter/inch dimension definitions for 1x1, 2x2, Passport (35x45mm), and 1.5x1.5. Row-based packing layout engine for Letter, A4, and 4x6" photo paper (7/7 vitest tests pass).
- [x] **Print-Ready PDF Generation**: Vector point mapping (`72 pt/in`) via `pdf-lib` guaranteeing 100% physical scale ruler accuracy with optional hairline scissor cutting borders.
- [x] **Word Document (.docx) Generation**: OpenXML `.docx` generator via `jszip` embedding photo tables with exact EMUs and DXA cell widths.
- [x] **High-Res Canvas Rendering**: 300 DPI raster canvas export for photo kiosks and live interactive document page preview.
- [x] **Tool View & Biometric Framing (`src/renderer/tools/id-photo-maker/IdPhotoMakerTool.tsx`)**: interactive zoom/pan controls, biometric head & eye-line guides, solid background color fills (White, Off-White, Sky Blue, Red), formal bottom white nametag banner, package presets (8 1x1, 4 2x2, Combo A/B/C), sample studio photo loader, and multi-format export buttons.
- [x] **Registry & Documentation (`src/renderer/tools/index.ts`, `TOOL_CATALOG.md`, `DECISIONS.md`, `PROGRESS.md`)**: Registered under `images` category with Lucide `IdCard` icon (total 76 tools).

## Tool #77 — Token & Context Studio (`token-counter`)

**Goal:** Provide an offline BPE token counter, multi-model context window visualizer, and local API cost estimator for AI developers and writers without external APIs or cloud dependencies.

- [x] **BPE Pre-Tokenizer & Subsegmentation Engine (`src/renderer/tools/token-counter/logic.ts`, `logic.test.ts`)**: Standard regex matching cl100k/o200k pre-tokenizer pattern, subsegmentation for compound words, multi-digit numbers, whitespace, and CJK ideographs (17/17 vitest tests pass).
- [x] **Multi-Model Profiles & Estimation Ratios**: Calibrated token and pricing models for GPT-4o, GPT-4o mini, Claude 3.5 Sonnet, Claude 3.5 Haiku, Llama 3.1 70B, Gemini 1.5 Pro, and Gemini 1.5 Flash.
- [x] **Interactive Token Visualizer**: Color-coded token chunks rendered with 6 rotating dark-mode pastel tints, hover details showing token index, character spans, and escaped whitespace representations.
- [x] **Context Window Utilization Gauge**: Visual progress bar showing percentage fill against model context limits (128k, 200k, 1M, 2M) with status indicators (safe/warning/exceeded) and headroom calculations.
- [x] **Cost Projection Calculator**: Real-time calculation of prompt input cost, configurable completion token output cost, total per-request cost, and 1k request batch projections.
- [x] **Tool View & Universal Input (`src/renderer/tools/token-counter/TokenCounterTool.tsx`)**: Code/prompt textarea with live character/word/line counters, sample presets (System Prompt, React Component, JSON Schema, Markdown, Numbers), and file drag & drop loader.
- [x] **Registry & Documentation (`src/renderer/tools/index.ts`, `TOOL_CATALOG.md`, `DECISIONS.md`, `PROGRESS.md`)**: Registered under `future` category with Lucide `Cpu` icon (total 77 tools).

## Tool #78 — Local LLM Playground & Benchmark [BETA] (`local-llm-playground`)

**Goal:** Provide a local-first interface to interact with, test prompts on, and benchmark local AI models (Ollama, LM Studio) on local CPU/GPU with real-time tokens/sec telemetry, TTFT metrics, and offline simulation fallback. Currently tested as a Beta tool.

- [x] **Local Client Protocol & Parser (`src/renderer/tools/local-llm-playground/logic.ts`, `logic.test.ts`)**: Ollama and OpenAI-compatible endpoint detection, NDJSON streaming parser, and nanosecond/millisecond hardware telemetry calculators (12/12 vitest tests pass).
- [x] **Real-Time Benchmark Telemetry**: Calculates exact tokens per second (tok/s), Time-to-First-Token (TTFT), prompt evaluation duration, and total latency.
- [x] **Offline Simulation Sandbox**: Bundled realistic streaming simulation for `llama-3.2-3b-sim`, `deepseek-r1-7b-sim`, and `phi-4-14b-sim` with authentic token speeds (~70-90 tok/s).
- [x] **Tool View & BETA Branding (`src/renderer/tools/local-llm-playground/LocalLlmPlaygroundTool.tsx`)**: Full chat & prompt playground, streaming cursor, stop generation via AbortController, quick starter prompts, system prompt presets, and hyperparameter sliders (temperature, top-p, max tokens).
- [x] **Registry & Documentation (`src/renderer/tools/index.ts`, `TOOL_CATALOG.md`, `DECISIONS.md`, `PROGRESS.md`)**: Registered under `future` category with Lucide `Bot` icon and `isBeta: true` flag matching `ascii-banner` (total 78 tools).

## Queue Workflow View — Visual Pipeline Orchestrator [BETA v0.2.2]

**Goal:** Transform the Queue Tools feature into an interactive, full-screen workflow canvas view (using node-graph workflow patterns inspired by n8n, MIT App Inventor, and Node-RED as design reference) for visually composing, connecting, executing, and saving multi-tool pipelines across all 78 local utilities. Tagged as independent feature version `v0.2.2` with strict SemVer incrementation rules.

- [x] **Bespoke Native Canvas Engine (`src/renderer/features/workflow/WorkflowCanvas.tsx`, `WorkflowEdgeRenderer.tsx`, `WorkflowNodeCard.tsx`)**: Zero-dependency React + SVG architecture with GPU CSS transforms (`translate` + `scale`), 60fps panning, trackpad/wheel zooming (30% to 200%), 20px grid snapping, smooth cubic Bézier vector wires with live `wireDash` pulse animation during execution, and midpoint cable delete buttons. Clean empty canvas on start.
- [x] **Full-Screen Workstation Layout & Shell Integration (`src/renderer/features/shell/Sidebar.tsx`, `App.tsx`, `QueueView.tsx`)**: Responsive sidebar collapse on navigating to Queue view, explicit expand/collapse toggle (`PanelLeft` / `PanelLeftClose`), global `Ctrl+B` shortcut, and full-bleed overflow-hidden container layout. Canonical amber `BETA` pill in sidebar.
- [x] **Uninhibited Drag-and-Drop Tool Palette & Recipes Drawers (`src/renderer/features/workflow/WorkflowToolDrawer.tsx`, `WorkflowTemplatesDrawer.tsx`)**: Smooth opening/closing slide & fade transitions without backdrop blur overlays so users can freely drag and drop nodes directly onto the visible canvas.
- [x] **Direct Node Inputs & Strict Validation (`src/renderer/features/workflow/WorkflowNodeCard.tsx`, `WorkflowCanvas.tsx`)**: Direct native OS file picking (`window.stash.dialogs.openFile`), drag-and-drop file attachment onto cards, and text payload input. Strict pre-run validation blocks pipeline execution if any required tool inputs are missing.
- [x] **Topological DAG Execution Engine (`src/renderer/features/workflow/execution.ts`, `workflow.test.ts`)**: Cycle detection, Kahn's algorithm topological sorting, real file/text artifact passing between tools without synthetic dummy inputs, and real-time node execution status badges (`idle`, `running`, `success`, `error`) (10/10 vitest tests pass).
- [x] **Workflow Templates & Recipe Sharing (`src/renderer/features/workflow/WorkflowTemplateModal.tsx`, `WorkflowTemplatesDrawer.tsx`, `presets.ts`)**: "Save Workflow as Template" modal saving pipelines to local SQLite (`workflow.userTemplates`), 4 built-in official workstation recipes (Photo ID Studio, Media Transcoder, Document Security, API Payload Validator), and 1-click `.stashflow.json` file export/import.
- [x] **Bidirectional Interoperability (`src/renderer/features/workflow/layout.ts`, `src/renderer/stores/queue.ts`)**: Auto-layout Left-to-Right DAG positioning, bidirectional conversion between linear `QueueStep` and `WorkflowGraph`, and seamless view switcher between Visual Canvas and Linear Queue.
- [x] **Multi-Trigger Interaction Layer (`WorkflowCanvas.tsx`, `WorkflowNodeCard.tsx`)**: Double-click node to open details, header Settings icon button, right-click dark workstation context menu (Configure, Duplicate, Delete), and keyboard shortcuts (`Enter` to inspect, `Ctrl+D` to duplicate, `Del` to remove, `Esc` to dismiss).
- [x] **Node Detail & Parameters Drawer (`WorkflowNodeDetailDrawer.tsx`)**: n8n-style slide-over drawer without background blur, inline custom label renaming, dynamic tool parameters (image quality/format/resizing, PDF ranges/watermark/rotation, text case/delimiter/indentation), input files & text payload manager, upstream/downstream wiring topology with 1-click disconnect, and isolated single-step test runner with live output preview and duration metrics.
- [x] **Card File Appending & Drag-Over Feedback (`WorkflowNodeCard.tsx`, `WorkflowCanvas.tsx`)**: Accumulated file attachments and deduplication on repeated drag-and-drops or file picks, active `isDragOver` card-level hover glow, interactive output file inspector pills, and guarded clear canvas confirmation check.
- [x] **Rigorous Code Quality & Robustness Loop (`WorkflowNodeCard.tsx`, `WorkflowNodeDetailDrawer.tsx`, `WorkflowCanvas.tsx`, `WorkflowTemplateModal.tsx`, `WorkflowOutputDrawer.tsx`)**: Greploop inspection pass 1 cleanups: cable port alignment to exact `NODE_WIDTH` (260px), stable draft label effect dependencies, step runner required input pre-validation, window-level pointerup drag safety, modal backdrop blur removal, and output drawer "Reveal in Explorer" actions.
- [x] **Drawer In/Out Animation & Stash Quick Access Integration (`WorkflowNodeDetailDrawer.tsx`, `WorkflowStashPickerModal.tsx`, `version.ts`)**: Smooth enter/exit transition animations for the node inspector drawer (`cubic-bezier(0.22, 1, 0.36, 1)`), drawer header Stash shortcut button, file dropzone Stash action buttons, 1-click recent Stash assets quick strip, and full Stash & Gallery quick access asset picker modal with real-time search, category filtering (All, Recommended, Images, Documents, Audio, Video, Favorites), thumbnails, and multi-asset attachment.
- [x] **Independent Feature Semantic Versioning Contract (`version.ts`, `AGENTS.md`, `DECISIONS.md ADR-040`)**: `QUEUE_WORKFLOW_VERSION = '0.2.6'` with mandatory SemVer bump on every push (patch for UI/UX/bug fixes, minor for features, major for schema breaking/BETA graduation).

### Completed Queue Workflow Features
- [x] **Incompatible Wire Connection Validation & Link Prevention (`execution.ts`, `WorkflowCanvas.tsx`, `WorkflowNodeCard.tsx`, `version.ts`)**: Prevent connecting cables between incompatible tool ports (text-to-files mismatch, missing tool capabilities, cross-domain media mismatches like audio into images, DAG circular dependency loops) with instant rejection warning toasts; real-time visual compatibility card states (`COMPATIBLE` emerald glow with pulsing input ports vs. dimmed `INCOMPATIBLE` warning badges with error reason tooltips); card-level wire drop auto-wiring; while keeping canvas tool placement 100% unconstrained.
- [x] **Drawer Wheel Zoom Isolation & Overscroll Containment (`WorkflowCanvas.tsx`, `WorkflowToolDrawer.tsx`, `WorkflowTemplatesDrawer.tsx`, `WorkflowNodeDetailDrawer.tsx`, `WorkflowOutputDrawer.tsx`, `WorkflowTemplateModal.tsx`, `WorkflowStashPickerModal.tsx`, `WorkflowToolbar.tsx`, `version.ts`)**: Isolate mouse wheel and trackpad scroll events originating inside drawers and modals from bubbling to the canvas root container via `onWheel={(e) => e.stopPropagation()}` and `target.closest('[data-drawer]...')` ancestry guards, preventing unintended canvas zooming while scrolling through tools, templates, or asset drawers.

### Upcoming Queue Workflow Candidate Tasks

Local v0.3.0 implementation is verified; parent task stays in progress pending user QA. See `docs/workflow-audit/README.md` and CSV matrix. Static domain compatibility is not codec validation or real pipeline execution.
- [x] Revalidate saved/imported graph connections before any pipeline node starts.
- [x] Correct Image Slicer to mixed image/ZIP output; verified individual download and ZIP handlers (lines 112-140), regression test and regenerated matrix. Latest gates: 917 tests / 92 files, typecheck, lint and build pass.
- [ ] Follow-up: parameter/format-aware artifact contracts, real processor adapters, and linear-queue parity.
- [ ] Follow-up: revise the legacy Photo ID recipe (mixed output -> image wire); it now fails preflight rather than silently executing.
- [-] **Exhaustive Tool Compatibility & Incompatibility Audit Checklist (`execution.ts`, `workflow.test.ts`)**:
  - [x] Audit all 78 registered tools against actual file input/output implementations.
  - [x] Replace UI-category inference with explicit directional domains; reject unknown domains.
  - [x] Verify all 6,084 ordered pairs (all four port combinations) against an independent audit fixture and export a reviewable matrix.
  - [x] Run focused/full tests, typecheck, lint, format, build and independent review; record limitations.
  - [ ] User tests local `union-alpha/feature-validator` branch before any push or merge.
  - Fix cross-category media matching bugs where tools whose UI category differs from their media domain fall through validation (e.g. `Audio Extractor` audio output connecting to `Icon Pack Generator` or `QR Decoder` in the `developer` category).
  - Generate and verify a comprehensive N × N compatibility and incompatibility checklist matrix covering all 78 tools across all categories (`images`, `audio`, `video`, `documents`, `developer`, `text`, `files`, `future`).
  - Introduce semantic domain classification helpers (e.g. `IMAGE_CONSUMING_TOOL_IDS`, `AUDIO_CONSUMING_TOOL_IDS`, `DOC_CONSUMING_TOOL_IDS`) to strictly enforce valid media inputs regardless of top-level sidebar category.
  - Expand test suite in `workflow.test.ts` to assert all valid links and reject all invalid cross-domain pairings.

## Milestone 11 — Future: Hermanos Desktop App Starter Template & UI/UX Design System Extraction

**Goal:** Decouple Hermanos Stash's signature UI/UX design language and local-first Electron engine into a clean, reusable application boilerplate template for upcoming Hermanos desktop applications. *(Planned — do not implement yet until overall app build is finalized)*

- [ ] **Phase 1: Visual Identity & Brand System Template**
  - [ ] Retain and package the signature giant `HERMANOS` background watermark backdrop (`Wordmark.tsx` + `.wordmark` CSS) as the persistent fixed backdrop behind all app views.
  - [ ] Extract the core dark workstation palette (`#0c0d0e`, `#141618`, `#1a1d20`), gold/amber accents, and translucent surfaces into a self-contained theme module.
  - [ ] Standardize the typography scale (Playfair Display 800 display, Inter UI, JetBrains Mono code) with Google Font asset bundlers.
- [ ] **Phase 2: Shell & Navigation Architecture Boilerplate**
  - [ ] Parameterize the responsive sidebar with collapsible shadcn-style accordions, badges, and view routing.
  - [ ] Extract the global command palette (`Cmd/Ctrl+K`), quick switcher, and search primitives into plug-and-play components.
  - [ ] Extract the notification & toast system, drawer drawers, and modal/dialog managers.
- [ ] **Phase 3: Core Component Library (UI Kit)**
  - [ ] Package standardized components: full-width `DropZone` (Archive Inspector style), `Panel`, `Button`, `IconButton`, `Slider`, `Toggle`, `FieldRow`, `Input`, `Select`, `Spinner`, `ProgressBar`, `FileListPanel`, `ResultActions`.
- [ ] **Phase 4: Local-First Desktop Engine (Electron + Vite + React + TS)**
  - [ ] Provide hardened main/preload IPC bridge boilerplate with structured error normalization.
  - [ ] Provide persistent SQLite store service (key-value, recents, user preferences) ready out-of-the-box.
  - [ ] Provide temp workspace management with automatic filesystem lifecycle cleanup.
  - [ ] Provide progress event streaming and cancellation token hooks for background processors.
- [ ] **Phase 5: Template CLI / Starter Repository**
  - [ ] Scaffold a standalone starter template repo (`hermanos-desktop-starter` or `template/`) with clean configuration, zero domain tool coupling, and a rapid setup guide for spinning up new Hermanos apps.


