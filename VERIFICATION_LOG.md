# Hermanos Stash — Verification Log

Per-tool evidence against `TOOL_SPEC.md` ("Adding a tool checklist", standard
states) and `VERIFY.md` ("Tool verification", "UX checks"). Maintained for every
future tool batch.

Static gates at time of logging: `tsc` clean · `eslint` clean · `prettier` clean ·
**319/319 vitest tests (30 files)** · `electron-vite build` clean (per-tool lazy
chunks) · smoke boot `STASH_SMOKE_OK`.

## Registry (34 tools)

| # | Tool id | Category | Logic tests | Progress + Cancel | History records |
|---|---|---|---|---|---|
| 1 | json-format | text | 16 | n/a (sync) | n/a (text) |
| 2 | base64-codec | text | 12 | n/a (sync) | n/a (text) |
| 3 | markdown-preview | text | 12 | n/a (sync) | n/a (text) |
| 4 | yaml-json | text | 8 | n/a (sync) | n/a (text) |
| 5 | csv-json | text | 25 | n/a (sync) | n/a (text) |
| 6 | text-diff | text | 9 | explicit compute | n/a (text) |
| 7 | regex-tester | developer | 10 | n/a (sync) | n/a (text) |
| 8 | jwt-decoder | developer | 8 | n/a (sync) | n/a (text) |
| 9 | timestamp-converter | developer | 7 | live ticking | n/a |
| 10 | uuid-generator | developer | 6 | n/a (local) | n/a |
| 11 | url-utils | developer | 10 | n/a (sync) | n/a (text) |
| 12 | hash-generator | developer | 5 | streaming status text | yes (file mode) |
| 13 | qr-generator | developer | 6 | n/a (fast) | yes (save-png) |
| 14 | file-metadata | files | 9 | per-row spinner | yes (inspect) |
| 15 | zip-create | files | archives suite (7) | indeterminate only (capability honest) | yes |
| 16 | zip-extract | files | ↑ | none claimed | yes + skipped warnings |
| 17 | image-preview | images | 5 | read spinner | yes (open) |
| 18 | image-convert | images | images suite (8) | real ratio + cancel | yes (per file) |
| 19 | image-compress | images | ↑ | real ratio + cancel | yes (per file) |
| 20 | image-exif | images | 6 | parse spinner | read-only inspection |
| 21 | pdf-preview | documents | shared pdfjs suite | page render local | yes (open) |
| 22 | pdf-merge | documents | pdf suite (6+) | indeterminate only (capability honest) | yes |
| 23 | pdf-split | documents | parser suites (23) | real per-group ratio + cancel | yes |
| 24 | pdf-rotate | documents | ↑ | fast op | yes |
| 25 | pdf-compress | documents | ↑ | fast op | yes |
| 26 | pdf-reorder | documents | sequence parser tests | fast op | yes |
| 27 | images-to-pdf | documents | ↑ | fast op | yes |
| 28 | pdf-to-images | documents | logic (6) | per-page ratio + cancel flag | yes (zip) |
| 29 | video-convert | video | media suite (~20) | ffmpeg `-progress` ratio + kill-cancel | yes |
| 30 | video-compress | video | ↑ | same | yes |
| 31 | video-to-gif | video | ↑ | two-pass split progress + cancel | yes |
| 32 | extract-audio | audio | ↑ | same + duration verify ±10% | yes |
| 33 | audio-convert | audio | ↑ | same + duration verify ±10% | yes |
| 34 | prompt-library | future | logic 12 + store 2 | n/a (local CRUD) | n/a (own storage) |

## TOOL_SPEC.md — "Adding a tool checklist"

- [x] Stable kebab-case ID — enforced by registry validation (+test).
- [x] Category/tags from taxonomy — enforced by registry category check.
- [x] Metadata complete — definition field validation (+integrity test).
- [x] Processor/service implemented — pure logic module or main service each.
- [x] UI implemented — lazy view mapped 1:1 (integrity test: no orphans).
- [x] All relevant states handled — see sweep below.
- [x] Tests exist — 319 total; media/video/audio tools covered via
      `processing/media.test.ts` + `processing/images.test.ts` shared suites.
- [x] Registered in one place — `src/renderer/tools/index.ts`.
- [x] Searchable metadata — fuzzy search tested in registry suite.
- [x] Favorite/recent behavior — generic shell feature, works for all tools.
- [x] History integration — table above; read-only/text tools intentionally skip.
- [x] Build & verification run — gates listed above.

### Standard states sweep (@ui-reviewer, code-level audit)

idle / dragOver(armed) / processing / success / error covered in **all view
components**; validating/ready additionally present where meaningful (pdf-split /
pdf-rotate / pdf-reorder live range validation, per-row states in file-metadata and
hash-generator). FFmpeg-gated tools render an instructive "FFmpeg not found" empty
state instead of a broken workspace.

## VERIFY.md — "Tool verification" spot-evidence

Representative evidence per interaction model (full suites in git history):

1. Normal input — integration test generated real media via the user's local
   binaries: testsrc MP4 -> WebM convert -> probe-verified -> WAV extract with
   duration asserted (0.5s +/- 0.2).
2. Malformed input — corrupt-PDF rejection (forced page-tree access), invalid
   JSON/YAML errors carry line/column, bad Base64/JWT/regex cases asserted.
3. Unsupported input — DropZone extension filters + main-side re-validation;
   encrypted PDFs rejected with actionable message naming the file.
4. Boundary conditions — 1e11 s/ms timestamp boundary, diff MAX_LINES
   exact-at-limit, CSV unclosed-quote line number, CRF/bitrate clamps, caps.
5. Output validity — sharp format re-detection; ffprobe re-probe of every media
   output; pdf-lib reload asserting pageCount/rotation/order (geometry-based).
6. Cleanup — temp workspace stale purge + quit wipe (unit-tested); per-operation
   cleanup on cancel/error paths in batch runners.
7. History entries — table above; verified fire-and-forget (never breaks UX).
8. Search/category/tag registration — integrity test + registry tests.
9. Favorite behavior — registry-driven shell feature exercised by all tools.

### UX checks (@ui-reviewer verdict: PASS-WITH-FINDINGS -> findings fixed)

- Keyboard navigation / visible focus / aria labels / no color-only status:
  structurally enforced by shared primitives; audit found one violation
  (hover-only unfavorite button in Sidebar) — FIXED.
- Capability honesty: `supportsProgress` removed from zip-create and pdf-merge
  (no real progress emitted) — FIXED.
- Silent clipboard failure in uuid-generator — FIXED with try/catch + toasts.
- Missing history record for QR save — FIXED.
- Dead placeholder button in HomeView removed — FIXED (principle 11).
- Hardcoded KB formatting in image-convert replaced with formatBytes — FIXED.
- Remaining accepted lows: Settings clear-history is single-click (text warns;
  two-step confirm queued), Input focus ring is border-shift only.

## TOOL_CATALOG.md cross-check

The catalog is explicitly "a living catalog, not a promise" (superset). Coverage
of committed scope (PRD §7 MVP + TASKS.md Milestones 2 and 4):

| Committed item | Shipped as |
|---|---|
| PDF preview | pdf-preview |
| Image preview | image-preview |
| JSON formatter/validator | json-format |
| Image converter | image-convert |
| Image compressor | image-compress |
| PDF merger | pdf-merge |
| PDF splitter | pdf-split |
| ZIP creator/extractor | zip-create + zip-extract |
| File metadata viewer | file-metadata |
| Base64 encoder/decoder | base64-codec |
| QR generator | qr-generator |
| PDF page extraction | pdf-split (range extraction) |
| PDF page reorder | pdf-reorder |
| PDF rotation | pdf-rotate |
| PDF compression | pdf-compress |
| Images -> PDF | images-to-pdf |
| PDF -> images | pdf-to-images |
| WebP tools | covered by Image Converter (WebP target) |
| EXIF viewer | image-exif |
| Video converter/compressor/GIF | video-convert / video-compress / video-to-gif |
| Audio extraction/converter | extract-audio / audio-convert |
| Markdown preview | markdown-preview |
| YAML <-> JSON | yaml-json |
| CSV <-> JSON | csv-json |
| Text diff | text-diff |
| Regex tester | regex-tester |
| JWT decoder | jwt-decoder |
| Timestamp converter | timestamp-converter |
| Hash generator | hash-generator |
| UUID generator | uuid-generator |
| URL utilities | url-utils |

Remaining catalog entries (batch rename, duplicate finder, archive inspector,
contact sheet, cron helper, SQL/CSS formatters, user-agent parser, MIME lookup,
HTTP status reference, prompt-organizer category) are UNCOMMITTED candidates per
AGENTS.md scope discipline — not promised for any milestone.

## Desktop checks (VERIFY.md) — automated E2E probe

`scripts/e2e-probe.mjs` launches the built app over CDP and drives the real UI:

- Bridge sanity (app info, typed bridge present).
- Favorites: SQLite roundtrip via the bridge AND a real star click in the DOM
  (aria-pressed flips, sidebar Favorites section appears).
- Settings navigation via sidebar click — view renders, not blank.
- Renderer exceptions + console errors captured; exit code non-zero on failure.

Latest run: all green (`blank:false`, `exceptions:[]`). Known harmless noise:
a `startupData`/`preloadScripts` console error appears only under
`--remote-debugging-port` sessions (CDP devtools target); normal launches are
clean. Probe cleanup kills the true Electron PID tree on Windows.

A second harness, `scripts/e2e-drag-probe.mjs`, synthesizes a real OS-backed
drag via CDP `Input.dispatchDragEvent` (with the fixture file registered in
the drag data) onto the live DropZone and asserts the tool lists the dropped
filename — this is the regression test for the `File.path` removal fix.
Note: CDP input coordinates are DIPs; CSS-px rects must be multiplied by the
renderer zoom factor.

Human QA findings (first user pass) and resolutions:

| Report | Root cause | Resolution |
|---|---|---|
| "Can't favorite tools" | Stars were hover-only invisible on home cards; dev session also held stale HMR state | Stars visible at rest (60% opacity); root error boundary added; verified working via CDP probe |
| Recents should cap at 5 | Limit was 8 | `RECENTS_LIMIT = 5` |
| Settings = black screen | Stale-HMR crash class; no repro in fresh builds (probe proves render) | RootErrorBoundary with role=alert + Reload button |
| UI too small | Default zoom 100% | `zoomFactor: 1.1`; titlebar overlay DIPs aligned (44/154) |
| Drag-and-drop rejects files (some tools); click-to-browse works | Confirmed: Electron ≥32 removed `File.path` — DropZone read `file.path` → always undefined for drops | FIXED: `webUtils.getPathForFile` exposed via preload bridge (`stash.files.getPathForFile`); verified by `e2e-drag-probe.mjs` (real OS-backed drop → tool receives path) |

## Release gate status (VERIFY.md)

- [x] Automated tests pass (319)
- [x] Build passes (+ smoke boot, dev and packaged exe)
- [x] Packaging pipeline verified — `npm run package` → win-unpacked build with
      FFmpeg binaries bundled; packaged exe boots (`STASH_SMOKE_OK`). NSIS
      installer via `npm run dist` when a distributable is wanted.
- [ ] Core user flows manually inspected by a human — PENDING USER QA
      (agent-side verification is code-level + integration-test level only)
- [x] No known blocker remains
- [x] PROGRESS.md contains evidence
- [x] TASKS.md accurate
