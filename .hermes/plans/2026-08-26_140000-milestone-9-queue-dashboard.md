# Milestone 9 — Batch Queue Runner + Usage Dashboard

**Goal:** Add automation depth (queue chaining) and self-awareness (usage insights) to the
launcher-grade shell. Both features reuse existing infrastructure.

---

## Feature 1: Batch Queue Runner

### What it does
- A new **Queue Builder** view (sidebar section → "Queue") where you drag tools into an
  ordered list, configure each tool's parameters, and save the queue as a named preset.
- **Run Queue** button: drops a file (or folder) onto the queue → tools execute in sequence,
  each tool's output files become the next tool's inputs. Progress aggregated across all
  steps.
- **Queue presets** persisted in prefs (`queue.presets[]`), exported/imported alongside
  settings backup.

### Why it fits
- Users already chain tools manually (compress → rename → zip). This makes it one drop.
- Reuses: DropRouter, media scaffold job lifecycle, `stash.history.record`, prefs system,
  tool registry capabilities (`acceptsFiles`, `producesFiles`, `acceptsMultipleFiles`).

### Architecture

```
QueueRunner (renderer)                Main process
    │                                      │
    ├─ validate chain capability ────────►│
    ├─ for each step:
    │    ├─ resolve inputs ──────────────►│ (file paths from prev output)
    │    ├─ invoke tool ─────────────────►│ (existing IPC per tool)
    │    ├─ collect outputs ─────────────►│
    │    └─ update progress (aggregated) ◄│
    └─ record history ───────────────────►│ (activity + per-step detail)
```

### Capability validation (prevents broken chains)
- Tool A `producesFiles: true` → Tool B `acceptsFiles: true` required
- `acceptsMultipleFiles` vs single-file respected
- Circular chains rejected

### UI entry points
1. **Sidebar "Queue" section** → opens Queue Builder (list + right inspector)
2. **Palette** → "Queue: …" items open builder pre-loaded
3. **Drop zone on Queue Builder** → drag file/folder → "Run Queue" enabled
4. **Queue presets dropdown** in builder header

### Persistence
- `queue.presets`: array of `{ id, name, steps: [{ toolId, params }] }`
- `queue.lastUsed`: most recent preset ID (for quick re-run)
- Exported in `.stash-profile` (see Milestone 10)

---

## Feature 2: Usage Dashboard

### What it shows (read-only, no new persistence)
- **Top tools** (last 7/30 days): bar chart by run count, with "open tool" action
- **Volume processed**: total input bytes / output bytes / % saved (media tools)
- **Time saved estimate**: sum of `durationMs` across history vs manual baseline
- **Category breakdown**: donut chart (files, images, video, text, dev, etc.)
- **Recent activity feed**: last 20 runs with status, tool, duration, file count
- **Quick filters**: today / this week / this month / all time

### Data source
- `activity` table (already has `tool_id`, `duration_ms`, `status`, `inputs_json`, `outputs_json`)
- `recents` table (last-used timestamps)
- Tool capabilities (`acceptsFiles`, `requiresNativeProcessor`)

### UI
- **Sidebar "Insights" section** (below Queue) → opens Dashboard view
- **Palette** → "Usage Dashboard" opens it
- **Settings → Appearance → "Show usage in status bar"** toggle (adds compact stat to status bar)

### Charts
- Reuse `color-converter` engine for palette
- Simple canvas/SVG bars — no new deps (weight < 2KB)

---

## Implementation order (dependency-aware)

1. **Queue capability validation helper** (shared, tested)
2. **Queue Runner core** (renderer + main IPC for sequenced execution)
3. **Queue Builder UI** (sidebar section + inspector + preset CRUD)
4. **Usage Dashboard UI** (reads activity/recents, renders charts)
5. **Sidebar integration** (Queue + Insights sections)
6. **Settings/Profile export** (enables queue preset portability — Milestone 10)

---

## Files to touch (estimated)

### New
- `src/renderer/features/shell/QueueBuilder.tsx`
- `src/renderer/features/shell/QueueRunner.tsx`
- `src/renderer/features/shell/UsageDashboard.tsx`
- `src/renderer/stores/queue.ts`
- `src/renderer/stores/usage.ts`
- `src/shared/utils/queue-validation.ts` (+ tests)
- `src/main/ipc/queue.ts` (main-side orchestration)

### Modified
- `src/renderer/app/App.tsx` (sidebar sections, view routing)
- `src/renderer/features/shell/Sidebar.tsx`
- `src/renderer/stores/nav.ts` (view types)
- `src/preload/index.ts` (queue IPC)
- `src/main/ipc/register.ts`

---

## Out of scope (for now)
- Scheduled/recurring queues (cron) — own milestone
- Conditional branching (if tool fails → run X else Y) — v2
- Queue sharing via URL/QR — v2
- Real-time dashboard updates (polling is fine for local-first)

---

## Acceptance criteria

**Queue Runner**
- [ ] Drag 3+ tools into builder, set params, save preset
- [ ] Drop file → runs all steps sequentially, shows aggregated progress
- [ ] Output of step N feeds step N+1 correctly
- [ ] Invalid chain rejected with clear message before run
- [ ] Preset export/import works

**Usage Dashboard**
- [ ] Renders without new persistence (reads existing DB)
- [ ] Top tools bar chart + category donut
- [ ] Time-range filters work
- [ ] "Open tool" from chart works
- [ ] Status bar toggle shows compact stat

---

## Rollback plan
- Both features behind feature flags in prefs (`queue.enabled`, `dashboard.enabled`)
- Disable → UI sections hidden, no background work