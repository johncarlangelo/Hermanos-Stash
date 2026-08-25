# Hermanos Stash — Verification Log

Per-tool evidence against `TOOL_SPEC.md` ("Adding a tool checklist", standard
states) and `VERIFY.md` ("Tool verification", "UX checks"). Maintained for every
future tool batch.

Static gates at time of logging: `tsc` clean · `eslint` clean · `prettier` clean ·
**319/319 vitest tests (30 files)** · `electron-vite build` clean (per-tool lazy
chunks) · smoke boot `STASH_SMOKE_OK`.

## Registry (50 tools)

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

Wave additions (M6): registry rows 35-43.

| # | Tool id | Category | Tests | Notes |
|---|---|---|---|---|
| 35 | sql-formatter | developer | 7 | mature `sql-formatter` lib wrapper |
| 36 | cron-explainer | developer | 11 | 5-field enforcement, next-run preview |
| 37 | text-cases | text | 20 | boundary tokenizer incl. acronyms |
| 38 | html-entities | text | 20 | encode/decode/slug modes |
| 39 | mime-lookup | developer | 9 | curated ~65-entry table |
| 40 | http-status | developer | 10 | full 63-code reference |
| 41 | batch-rename | files | 14 + live CDP probe | write-scoped folder ops, dry-run plan |
| 42 | color-converter | developer | 17 | WCAG contrast, harmonies |
| 43 | brand-bible | future | 12 | Markdown/JSON export, prefs autosave |

Also fixed: preload `fs.writeTextFile` payload mismatch (latent bug — channel always rejected; prompt-library export restored).

## Milestone 7 — shadcn/ui adoption + accent theme picker

Verification evidence for the UI platform refactor:

- **Typecheck:** `tsc --noEmit` → 0 errors after every step.
- **Tests:** 568 passing across 51 files (was 553/50; +15 accent-theme engine tests).
  The accent engine suite covers hover derivation direction, soft-tint string
  shape, luminance-based label contrast, the 3:1 visibility guard against every
  curated preset, and amber-default consistency with the CSS token values.
- **Build:** `electron-vite build` green at each commit; all 50 tool chunks emit.
- **Token bridge (`global.css`):** shadcn semantic variables
  (`--background/--primary/--popover/--ring/…`) mapped onto Stash tokens inside
  `@layer base`; `--color-*` entries stay in `@theme` so Tailwind generates
  utilities. Dark-only; no light block. Radius scale reuses the modest Stash
  xs–lg tokens directly.
- **Select migration:** Radix Select behind the exact legacy call surface
  (`value` / `onChange(e.target.value)` / `<option>` children) — 23 tool/shell
  call sites migrated with zero call-site edits. Keyboard nav, typeahead and
  portal rendering verified by component contract; native-select appearance
  removed.
- **Command palette on cmdk:** registry fuzzy scoring retained as the ranking
  source (`shouldFilter={false}`), cmdk provides focus capture/arrows/Esc;
  favorites group + tag chips preserved; seeded-query flow intact.
- **Accent picker:** Settings → Appearance gains preset swatches (amber default,
  sage, steel, rose, violet, teal), a free color input, live application via
  CSS-variable override on `--color-accent*`, persistence in prefs `ui.accent`,
  pre-paint startup apply in `main.tsx`, and an inline warning when a custom
  color falls below 3:1 contrast against `--color-base`.
- **Dialog/Tooltip primitives:** new `Overlays.tsx` (Radix Dialog + Tooltip)
  styled to DESIGN.md (overlay surface, line-strong border, pop entry);
  DropRouter's hand-rolled modal ported to Radix Dialog (focus trap, Esc,
  aria wiring from the primitive); FieldRow help hint now portal-rendered with
  collision-aware placement while keeping hover AND keyboard-focus triggers.
- **Button reconciliation:** legacy Stash API (primary/danger variants, sm/md
  sizes, loading prop) merged into shadcn cva architecture consuming tokens
  (`bg-accent text-accent-contrast`); hardcoded accent literals removed from
  components — everything flows through runtime-overridable variables.
- **Deliberately not adopted:** DropdownMenu and ScrollArea (no current call
  sites — will be added when first needed per scope discipline).
- **Human visual QA of the running app: PENDING USER QA** (per release gate).

### Review round (@architecture-reviewer / @design-reviewer / @ui-reviewer / @verifier)

All four reviewer agents audited the M7 commits; every blocking/important
finding was fixed and re-verified (typecheck 0 · build green · 568 tests):

- **Palette search regression (B1)** — the initial cmdk rewrite rendered all
  tools unconditionally behind `shouldFilter={false}`. Fixed: typed query now
  drives `toolRegistry.search()` top-9 as a "Results" group; empty query shows
  Favorites + full catalog; `Command.Empty` reachable again.
- **Palette layering** — backdrop div painted above rows swallowed mouse
  clicks, and cmdk's `className` never produced a card surface. Fixed via
  `overlayClassName`/`contentClassName` with a proper centered card.
- **Duplicate cmdk item identity** — favorites appeared in two groups with
  identical values; values now suffixed per group.
- **Seeded-query race** — palette input is controlled state keyed on `open`;
  seed consumption no longer depends on render-time store reads.
- **Accent picker persistence policy (I2/I3)** — free-picker drags apply live
  but persist debounced (300ms); dim accents (<3:1) are preview-only and
  auto-revert with an `role="alert"` warning instead of being saved; warning
  state also evaluates on load of a previously-saved color.
- **A11y (ui-review HIGH items)** — loading buttons announce via `aria-busy` +
  sr-only status; `focus:outline-none` tokens replaced with explicit visible
  focus-visible outlines on Select/Input/TextArea/Hint (WCAG 2.4.7); palette
  selected row gained a non-color cue (inset accent bar); tag chips show on
  keyboard selection, not hover only; AccentPicker uses `aria-pressed` group +
  check icon (not radio semantics without arrow keys).
- **Contrast (design #4)** — destructive fill darkened to `#b35a4c`
  (4.7:1 vs white label text, verified computationally).
- **Verifier's hex-literal catch** — AccentPicker default derives from
  `ACCENT_PRESETS[0].hex`, no hardcoded fallback.
- **Optional cleanups applied:** `--chart-*` vars reference status tokens;
  dead `softRgba` removed; single TooltipProvider hoisted to app root;
  DialogContent gained optional sr-only description; CSS default
  `--color-accent-contrast` aligned with engine output (`#16181d`);
  ACCENT_PREF_KEY duplication annotated.
- **Deferred by decision:** second-tier 4.5:1 accent-text warning tier,
  editable hex text input, RadixSelect scroll buttons — recorded as future
  candidates, none block M7.
- **Lint + formatting gate (added post-review):** `eslint` clean;
  `prettier --check` initially flagged 7 M7 files — reformatted and committed
  (`style: apply prettier to milestone 7 ui files`); full gate now
  typecheck 0 · lint clean · prettier clean · build green · 568 tests.
