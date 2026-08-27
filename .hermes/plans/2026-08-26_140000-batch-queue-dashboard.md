# Batch Queue Runner + Usage Dashboard — Plan

**Branch:** `batch-queue-dashboard` (off `main` at `a09c7a7`)

---

## 1. Batch Queue Runner

### Goal
Drag multiple tools into an ordered queue → one drop runs them sequentially with shared files piped through. Solves "I always compress → rename → zip" in one action.

### Architecture
- **New store:** `queueStore` — ordered array of `{ toolId, presetId?, options? }`, persisted in prefs `ui.queue`
- **New IPC:** `batch:run` (main) — receives queue + input files, runs each tool via existing processors, pipes outputs to next
- **UI surfaces:**
  - **Queue builder panel** (sidebar section or modal): drag-to-reorder, per-step preset selector, add/remove
  - **Run button** on builder + "Run Queue" in palette (Ctrl+Shift+Enter)
  - **Progress overlay**: per-step status, cancel, live logs

### Data flow
```
Drop files → Queue builder (ordered tool IDs + optional presets) →
  batch:run(inputFiles, queue) →
    For each step:
      resolve tool processor (existing `media-tool` / `file-tool` entry points)
      run with (files from previous step) + step.options
      collect outputs → next step's inputs
    Return final outputs + per-step metadata
```

### Reuse existing
- Tool processors already accept `inputPaths[]` + options → return `outputPaths[]`
- Progress bus / cancellation already wired
- Presets per tool (next feature) will plug into `step.options`

### Scope boundaries (v1)
- Sequential only (no parallel branches)
- File-only tools (text-only tools later)
- No conditional logic (if/else)
- Queue saved as a named "workflow" (optional, v2)

---

## 2. Usage Dashboard

### Goal
A glanceable "insights" view showing what you actually do with Stash — feeds back into launcher UX (pin suggestions, queue templates).

### Data source
- Existing `activity` table (already has tool_id, timestamp, status, duration, inputs/outputs)
- Existing `recents` + `favorites` prefs
- New: per-tool preset usage (when presets land)

### UI: new view `dashboard` (sidebar entry)
- **Header**: "This week" / "This month" / "All time" tabs
- **Cards (grid)**:
  - Top 5 tools (count + success rate + avg duration)
  - Biggest space saved (sum of `original - output` bytes from media tools)
  - Most processed file types (from `inputs` extensions)
  - Busiest days (heatmap calendar)
  - Current streak (days with ≥1 tool run)
- **Quick actions**: "Pin top 3", "Create queue from top combo"

### Implementation
- **New store:** `dashboardStore` — derives from `activity` via `window.stash.history.list(1000)` + local aggregation (no new IPC needed)
- **Refresh**: pull-to-refresh or auto on view enter
- **Empty state**: "Run a few tools to see insights"

---

## Order of work

1. **Branch + queue store + IPC skeleton** (commit)
2. **Queue builder UI** (commit)
3. **Batch runner main-side** (commit)
4. **Progress overlay + cancel** (commit)
5. **Dashboard store + view** (commit)
6. **Dashboard charts/cards** (commit)
7. **Integration polish** (queue→dashboard "create queue from top combo")
7. **Verify gates, merge**

---

## Files to touch (estimate)

| Area | Files |
|---|---|
| Queue store | `src/renderer/stores/queue.ts`, `.test.ts` |
| IPC | `src/shared/ipc.ts` (add `batch:run`), `src/main/ipc/register.ts`, `src/preload/index.ts` |
| Main runner | `src/main/services/batch-runner.ts` (new) |
| Queue UI | `src/renderer/features/shell/QueueBuilder.tsx` (new), sidebar integration |
| Progress overlay | `src/renderer/components/ui/BatchProgress.tsx` (new) |
| Dashboard store | `src/renderer/stores/dashboard.ts`, `.test.ts` |
| Dashboard view | `src/renderer/features/shell/DashboardView.tsx` (new), sidebar + nav |
| Palette integration | `CommandPalette.tsx` (add "Run Queue" item) |

---

## Acceptance criteria

**Queue runner:**
- [ ] Drag 3 tools into builder → save queue → drop files → all 3 run sequentially → final outputs saved
- [ ] Per-step preset selector works
- [ ] Cancel mid-run stops cleanly, partial outputs kept
- [ ] Progress overlay shows step name, file count, duration

**Dashboard:**
- [ ] View loads in <200ms (local aggregation)
- [ ] Top tools / space saved / file types / streak all accurate vs `activity` table
- [ ] Time-range tabs filter correctly
- [ ] "Pin top 3" actually pins those tools

---

## Out of scope (v1)
- Parallel execution branches
- Conditional logic (if tool A fails, run B)
- Text-only tool chaining
- Cloud sync of queues
- Scheduled/cron queue runs