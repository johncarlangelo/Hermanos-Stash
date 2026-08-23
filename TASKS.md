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

- [!] Drag-and-drop does not accept files in several file tools, while click-to-browse works fine. *(Suspected root cause: Electron ≥ 32 removed the `File.path` property on dropped files; `DropZone.tsx` reads `file.path`, which is now `undefined`, so every drop resolves to zero valid paths. Click-to-browse is unaffected because it uses the native dialog IPC which returns real paths. Fix direction: expose `webUtils.getPathForFile(file)` through the preload bridge and use it in `filterValid()`. Affects every tool built on the shared DropZone: image-preview, image-convert, image-compress, image-exif, pdf-* , zip-*, video-*, audio-*, file-metadata. Verify each after fixing, then flip this box.)*

## Future

- [ ] Prompt template organizer.
- [ ] Prompt formatter.
- [ ] Prompt variable builder.
- [ ] Local prompt history.
- [ ] Additional tool categories discovered through real usage.
