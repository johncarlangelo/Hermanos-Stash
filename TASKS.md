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

## Future

- [x] Prompt template organizer. *(delivered as the Prompt Library tool, Milestone 5)*
- [x] Prompt formatter. *(template variables + fill-in flow in the Prompt Library)*
- [x] Prompt variable builder. *(`{{variable}}` detection and fill-in-and-copy in the Prompt Library)*
- [x] Local prompt history. *(prompts persisted in SQLite via the Prompt Library)*
- [ ] Additional tool categories discovered through real usage.
