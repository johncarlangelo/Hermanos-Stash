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
- [-] Establish build/package workflow. *(electron-vite production build verified; installer packaging still pending)*

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
- [-] Build tag filtering. *(registry `byTag` + tag display shipped; dedicated tag-filter UI pending)*
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

- [ ] PDF page extraction.
- [ ] PDF page reorder.
- [ ] PDF rotation.
- [ ] PDF compression.
- [ ] Images → PDF.
- [ ] PDF → images.
- [ ] WebP tools.
- [ ] EXIF viewer.
- [x] Video converter.
- [x] Video compressor.
- [x] Video → GIF.
- [x] Audio extraction.
- [x] Audio converter.
- [x] Markdown preview. *(marked gfm/breaks + DOMPurify sanitize, live two-pane preview, Copy HTML)*
- [x] YAML ↔ JSON.
- [x] CSV ↔ JSON. *(hand-written strict RFC 4180 parser/serializer, header-row toggle, delimiter select)*
- [x] Text diff. *(LCS line diff, 2000-line guard, unified +/- rows)*
- [ ] Regex tester.
- [ ] JWT decoder.
- [ ] Timestamp converter.
- [ ] Hash generator.
- [ ] UUID generator.
- [ ] URL utilities.

## Future

- [ ] Prompt template organizer.
- [ ] Prompt formatter.
- [ ] Prompt variable builder.
- [ ] Local prompt history.
- [ ] Additional tool categories discovered through real usage.
