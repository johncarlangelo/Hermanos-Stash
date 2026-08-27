# HANDOFF DOCUMENT — Hermanos Stash Milestone 9 Implementation

**Date:** 2026-08-26  
**Branch:** `m9-queue-dashboard` (pushed to origin)  
**Status:** In progress — Queue Builder UI ~80% done, Queue Store + Validation complete  

---

## ✅ COMPLETED (Milestone 9 so far)

### 1. Queue Capability Validation (`src/shared/utils/queue-validation.ts` + tests)
- `canChain(from, to)` — validates tool A outputs → tool B inputs
- `validateQueueChain(tools[])` — validates entire chain, returns `{valid, errors[], warnings[]}`
- `getCompatibleNextTools(current, allTools)` / `getCompatiblePreviousTools` — for UI filtering
- **13/13 tests passing** — logic: consumer accepts files/text, producer must provide at least one matching type (OR logic for multi-input tools)

### 2. Queue Store (`src/renderer/stores/queue.ts` + tests)
- Zustand store with presets CRUD (`listPresets`, `getPreset`, `savePreset`, `deletePreset`, `setLastUsed`, `reorderPresets`, `initialize`)
- Persists to `prefs` via `window.stash.prefs` (keys: `queue.presets`, `queue.lastUsed`)
- **8/8 tests passing**

### 3. Broken Main-Process Queue Code REMOVED
- Removed `QueuesStore` from `src/main/services/stores.ts`
- Removed queue IPC handlers from `src/main/ipc/register.ts`
- Removed `queues` table from `src/main/services/db.ts`
- Removed queue types (`QueueSpec`, `QueueRunInput`, `QueueRecord`, `QueueSaveInput`) from `src/shared/ipc.ts`
- Removed queue bridge from `src/preload/index.ts`
- **Queue running will be implemented in renderer using existing tool IPC** (simpler, reuses existing media scaffold progress/FFmpeg infra)

---

## 🔄 IN PROGRESS

### 4. Queue Builder UI (`src/renderer/features/shell/QueueBuilder.tsx`) — ~80%
**Current state:** TypeScript errors remain (4), component mostly functional

**Remaining TS errors to fix:**
1. `_compatibleNextTools` declared but unused (line 125) — used in tool picker modal for compatibility filtering
2. `setEditingId(null)` → needs `undefined` (lines 146, 173) — state is `string | undefined`
3. `Select` component props mismatch — needs `value=""` instead of uncontrolled

**What works:**
- Step list with drag-reorder (up/down), remove, add-step drop zones
- Tool picker modal with search + compatibility filtering (greys out incompatible tools)
- Validation panel (errors/warnings from `validateQueueChain`)
- Preset CRUD: save/update/delete/load, preset selector dropdown
- Per-step params UI placeholder (ready for dynamic tool option forms)

**Imports cleaned:** Removed unused `QueueStep` interface, `ClearableTagInput`, `getCompatibleNextTools` (now used inline)

---

## 📋 NEXT TO IMPLEMENT (Priority Order)

| Task | File | Description |
|------|------|-------------|
| **Fix QueueBuilder TS errors** | `QueueBuilder.tsx` | 4 errors above — quick wins |
| **Queue Runner Core** | `src/renderer/features/shell/QueueRunner.tsx` | Sequential execution: for each step, invoke tool IPC with current files, collect outputs, feed next step. Reuse media scaffold job lifecycle + progress bus. |
| **Queue Runner View** | `src/renderer/features/shell/QueueView.tsx` | Drop zone → validate chain → run → show aggregated progress + per-step results |
| **Queue Store → Runner integration** | `nav.ts`, `App.tsx` | Add `queue` view type, wire sidebar "Queue" section |
| **Usage Dashboard** | `src/renderer/features/shell/UsageDashboard.tsx` | Read `activity` + `recents` tables, render metric cards + charts (bar/donut via canvas) |
| **Sidebar Integration** | `Sidebar.tsx`, `nav.ts` | Add "Queue" + "Insights" sections below Pinned/Favorites |
| **Settings/Profile Export** | `SettingsView.tsx` | Export/import `.stash-profile` (prefs + queue presets + prompt library) |

---

## 🔑 KEY FILES & LOCATIONS

```
src/
├── shared/
│   └── utils/
│       ├── queue-validation.ts          ✅ done + tested
│       └── queue-validation.test.ts     ✅ 13/13 pass
├── renderer/
│   ├── stores/
│   │   ├── queue.ts                     ✅ done + tested
│   │   └── queue.test.ts                ✅ 8/8 pass
│   ├── features/shell/
│   │   ├── QueueBuilder.tsx             🔄 80% (4 TS errors)
│   │   ├── QueueRunner.tsx              📋 next
│   │   ├── QueueView.tsx                📋 next
│   │   ├── UsageDashboard.tsx           📋 later
│   │   ├── Sidebar.tsx                  📋 add Queue/Insights
│   │   └── SettingsView.tsx             📋 profile export
│   └── stores/
│       ├── queue.ts                     ✅
│       └── nav.ts                       📋 add 'queue' view type
└── shared/
    └── utils/queue-validation.ts        ✅
```

---

## 🎯 IMMEDIATE NEXT STEPS (when resuming)

1. **Fix QueueBuilder.tsx TS errors** (5 min):
   - Line 125: `void _compatibleNextTools` (suppress unused)
   - Lines 146, 173: change `setEditingId(null)` → `setEditingId(undefined)`
   - Select: add `value=""` prop (already done) — verify `SelectProps` accepts it
   - Remove unused `_compatibleNextTools` or use it in picker

2. **Create QueueRunner.tsx** — core sequential execution:
   ```ts
   // For each step:
   //   - Get tool def, validate acceptsMultipleFiles || supportsBatch
   //   - Invoke tool via existing IPC (e.g., window.stash.processing.convertImages)
   //   - Collect output files, feed to next step
   //   - Emit progress via ProgressBus (reuse media scaffold pattern)
   ```

3. **Wire into nav + sidebar** → test end-to-end

---

## 🧪 VERIFICATION COMMANDS

```bash
cd "/d/Comsci things/Hermanos Stash"
npm run typecheck    # should be 0 errors
npm run build        # should succeed
npm run test         # 576+ tests pass
npx vitest run src/shared/utils/queue-validation.test.ts
npx vitest run src/renderer/stores/queue.test.ts
```

---

## 📝 NOTES

- **Don't push to main** — only push to `m9-queue-dashboard` branch
- **Queue runs in renderer** — uses existing tool IPC (`window.stash.processing.*`, `window.stash.files.*`), no new main-process code needed
- **Progress tracking** — reuse `ProgressBus` from media tools (already emits `progress:update` events)
- **History integration** — queue run = parent activity entry + child per-step entries (optional v2)

---

**Ready to continue.** Fix the 4 TS errors in QueueBuilder, then build QueueRunner.