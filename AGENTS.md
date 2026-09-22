# Hermanos Stash — Agent Operating Contract

## Mission

Build Hermanos Stash as a polished, local-first desktop utility suite: a single installed application containing many focused tools for files, documents, images, media, text, developer utilities, and future categories.

The product should feel like a cohesive premium utility workstation, not a directory of unrelated web tools.

## Non-negotiable principles

1. **Local-first:** user files stay on the machine unless a future feature explicitly requires otherwise.
2. **No account system for MVP.**
3. **No paid API/AI dependency.**
4. **Tools are modular:** adding a tool must not require rewriting the application shell.
5. **One window:** tools navigate within the application; do not spawn browser tabs/windows for normal workflows.
6. **Dark-only:** use a comfortable dark palette, never pure/OLED black as the main surface.
7. **Polished, restrained motion:** microinteractions and transitions should communicate state, not decorate the screen.
8. **Premium over flashy:** hierarchy, spacing, typography, consistency, and interaction quality matter more than effects.
9. **Accessibility is part of correctness.**
10. **Do not invent features merely because they are easy to implement.**
11. **Do not create placeholder UI that pretends an unfinished feature works.**
12. **Prefer existing mature libraries over custom implementations for difficult file/media formats.**

## Architecture direction

The target stack is:

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS + CSS Modules + design tokens
- Node.js APIs through a secure preload bridge
- SQLite for local preferences/history where persistence is useful
- PDF.js for PDF rendering/preview
- FFmpeg for media processing
- mature local libraries/CLI tools where appropriate

Keep renderer code browser-safe. Native filesystem/process access belongs behind the Electron main/preload boundary.

## Tool architecture

Every tool should have:

- stable ID
- category
- name
- description
- tags
- icon
- favorite support
- capability declaration
- input definition
- processing implementation
- result definition
- loading/progress state
- error state
- cancellation strategy when applicable
- dependency declaration & scanner registration (`dependencies.ts`) if the tool relies on external binaries, native modules, or local models
- tests
- documentation/metadata

Do not couple individual tools directly to unrelated UI screens.

### Beta Flagging Standard

When flagging a tool as **BETA** (e.g. experimental, active testing, newly prototyped):
1. **Use `isBeta: true` property on `ToolDefinition`** in `src/renderer/tools/index.ts`:
   ```ts
   {
     id: 'ascii-banner',
     name: 'ASCII Art & Retro Banner Generator',
     // ...
     isBeta: true
   }
   ```
2. **Do NOT put `'beta'` in the `tags` array.** Tags are reserved for domain search keywords.
3. **Do NOT prepend `[BETA]` to `name` or `description`.**
4. **Shell integration:** The platform shell automatically renders the canonical Stash amber `BETA` pill on tool cards in `HomeView`, tool headers in `ToolPage`, and search items in `CommandPalette`.
5. **Tool-internal header pill (if rendered):** Match the canonical pill style used by `AsciiBannerTool.tsx` and `SvgCreatorTool.tsx`:
   ```tsx
   <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 tracking-wider uppercase">
     BETA
   </span>
   ```
   Do not introduce custom icons (e.g. Sparkles) or arbitrary non-standard badge styles.

### Queue Workflow Tool Compatibility Contract

Whenever adding a new tool or modifying an existing tool in `src/renderer/tools/index.ts`:

1. **Mandatory Capability Declaration (`ToolDefinition.capabilities`):**
   Accurately declare all supported I/O types:
   - `acceptsFiles?: boolean` / `acceptsMultipleFiles?: boolean` / `producesFiles?: boolean`
   - `acceptsText?: boolean` / `producesText?: boolean`
   - `supportsBatch?: boolean` / `supportsProgress?: boolean` / `supportsCancellation?: boolean`
   Never leave file or text capabilities unstated. The Visual Queue Workflow dynamically derives port types (files vs. text anchors) from these flags.

2. **Domain vs. UI Category Disambiguation (`tool-domains.ts`):**
   - Never infer file compatibility from sidebar category: Icon Pack / QR Decoder consume images despite their `developer` category.
   - Review actual input and export handlers, then update `TOOL_FILE_DOMAINS` in `src/shared/utils/tool-domains.ts`. Its directional entries drive `areFileCategoriesCompatible` in `execution.ts`; do not add category fallbacks or bridge exemptions.
   - Domains: `image`, `audio`, `video`, `document` (PDF), `archive`, `textfile`, `any`. Input `any` means universal consumer; output `any` means mixed/unknown, not universally compatible.
   - Model bridges per side: Audio Extractor is video → audio; PDF → Images is document → archive (ZIP). Image Slicer exports individual images or ZIP, so its unselected output is mixed (`any`).
   - Keep missing domains fail-closed. Text outputs use text capability flags; same-domain compatibility does not guarantee matching codecs or actual processor execution.

3. **Mandatory Compatibility Test Coverage (`workflow.test.ts`):**
   - When introducing or altering a tool, add unit tests in `src/renderer/features/workflow/workflow.test.ts`:
     - Test valid connections to/from appropriate domain tools.
     - Test rejection of incompatible connections with clear warning messages.

4. **Generated matrix maintenance (mandatory for every new/changed tool):**
   - Independently update `AUDIT_ROWS` and receiver groups in `src/renderer/features/workflow/compatibility-audit.ts`. Do not derive expected classifications from the production domain table.
   - Run `npm run workflow:matrix`: tests export into a temporary directory first; only a passing run publishes `docs/workflow-audit/COMPATIBILITY_MATRIX.md`, `tools.csv`, and `compatibility.csv`. Do not hand-edit verdicts.
   - Run `npm run workflow:matrix:check` before completing a tool change. This read-only check exits nonzero for missing/stale artifacts. Counts scale automatically with the catalog: N² pairs, 4N² port combinations. Registry membership checks reject any missing audit entry.
   - Review and commit all three generated files with the tool change; update TASKS.md and verification evidence. Cover both incoming and outgoing connections.
   - Regenerate after changes to capabilities, domains, audit expectations, workflow version or rejection messages.
   - This command is CI-ready, but no CI workflow or automatic Git hook is currently configured. Until one is installed, running it is a mandatory developer/agent checklist step.
   - Retain the documented limits: static ports/media domains are not codec/content checks or proof of real processor execution.

5. **Mandatory Parameter Specification & Workspace Parity (`tool-params.ts`, `execution.ts`):**
   - Whenever adding or modifying a tool, never hardcode ad-hoc inputs in `WorkflowNodeDetailDrawer.tsx`.
   - Inspect the workspace tool view (`src/renderer/tools/<tool-id>/...`) and match its exact user-facing controls, keys, and defaults.
   - Register its canonical parameter schema in `src/renderer/features/workflow/tool-params.ts`. Provide aliases where legacy keys or recipe templates exist (e.g. `watermark` for `text`, `range` for `pageSpec`).
   - Implement real parameter consumption in `src/renderer/features/workflow/execution.ts` using alias fallbacks (`params.key ?? params.alias ?? default`).
   - Tools with standard automatic processing and no configurable parameters must be explicitly defined as parameterless so the drawer renders a clean informative message instead of phantom sliders.

### System Dependencies & Runtime Verifier Contract (`dependencies.ts`, `SettingsView.tsx`)

Whenever introducing a new tool that requires an external CLI binary, system daemon, native C++ module, AI model file, or non-trivial runtime dependency:

1. **Mandatory Scanner Registration (`src/main/services/dependencies.ts`):**
   - Register the dependency probe in `checkAllDependencies()` in `src/main/services/dependencies.ts`.
   - Provide accurate, typed metadata:
     - `id`: unique kebab-case identifier (e.g. `'tesseract'`, `'ffmpeg'`, `'sharp'`).
     - `name`: human-readable title (e.g. `'FFmpeg & FFprobe'`).
     - `category`: `'media' | 'document' | 'image' | 'storage' | 'ai' | 'runtime'`.
     - `status`: `'ready' | 'missing' | 'optional_offline' | 'degraded'`.
       - Core/bundled utilities must fail-closed to `'missing'` or `'degraded'` if unusable.
       - Local developer servers or background daemons (e.g. Ollama, LM Studio) that are optional must be marked `'optional_offline'`.
     - `version`: parsed or detected version string (e.g. `getVersion()`, `lib.version`, `row.ver`).
     - `path`: local filesystem path or URL endpoint if applicable.
     - `source`: `'bundled' | 'system' | 'embedded' | 'network'`.
     - `requiredFor`: array of tool names that consume this dependency (e.g. `['Video Converter', 'Audio Extractor']`).
     - `details`: concise technical summary of the engine state.
     - `troubleshooting`: clear, actionable guidance on where to place files (e.g. `resources/<dep>/`) or what terminal command to run.
2. **Rescan & Cache Invalidation:**
   - If the dependency resolution relies on an in-memory cache, ensure the cache is invalidated when `options?.invalidateCache` is passed so users clicking **Rescan / Refresh** in Settings immediately detect newly installed or copied files without restarting the app.
3. **Preload & UI Integration:**
   - Ensure the dependency scanner is exposed via `window.stash.system.checkDependencies()`.
   - The Settings view (`SettingsView.tsx`) automatically surfaces the registered item with status badges, version chips, reveal actions, troubleshooting alerts, and dependent tool tags.
4. **Mandatory Unit Test Coverage (`dependencies.test.ts`):**
   - Add unit test coverage in `src/main/services/dependencies.test.ts` asserting that the new dependency ID is probed, returned in the report, correctly categorized, and accurately counted in `report.summary`.
5. **1-Click On-Demand Dependency Installer (`installDependency`):**
   - **Zero installer bloat**: Do NOT bundle heavy binaries (FFmpeg, OCR tessdata, quantized AI models) into the main installer artifact. Keep them on-demand.
   - **One-by-one installation**: Installations in `SettingsView.tsx` must be triggered individually per dependency item, tracking state via `installingId` to prevent download collisions. Never add a bulk "Install All" button.
   - **Granular metadata**: Dependencies with automated downloaders must set `installable: true` and specify accurate `downloadSize` (e.g. `'~25 MB'`, `'~4 MB'`).
   - **Clean extraction & cache invalidation**: Downloads must unpack into isolated `resources/<dep>/` directories (e.g. `resources/ffmpeg/`, `resources/tessdata/`), set executable permissions on non-Windows platforms, and invalidate internal caches (e.g. `resetFfmpegCache()`) so the UI immediately detects the new binary without restarting.

### Feature Semantic Versioning (Queue Workflow View [BETA])

> [!IMPORTANT]
> **Strict Feature Exclusivity & Temporary Beta Lifecycle**:
> This semantic versioning rule applies **EXCLUSIVELY to the Queue Workflow feature** (`src/renderer/features/workflow/`). It does **NOT** apply to any other tool, shell view, or the overall desktop application (`package.json`).
> This feature version tag is an interim testing mechanism while the workflow engine undergoes rapid user testing and refinement; once testing is completed and the feature is stabilized, this version tag and incrementation rule will be cleanly removed.

1. **Canonical Version Source**:
   - Defined by `QUEUE_WORKFLOW_VERSION` in `src/renderer/features/workflow/version.ts`; read that file for its current value rather than duplicating a stale version example here.
   - Rendered across workflow view headers (`WorkflowToolbar.tsx`, `QueueView.tsx`) alongside the canonical amber `BETA` pill.
2. **Mandatory Incrementation on Every Push (Queue Workflow Only)**:
   Every pull request or commit that modifies files under `src/renderer/features/workflow/` or affects Queue Workflow behavior MUST increment `QUEUE_WORKFLOW_VERSION` according to strict Semantic Versioning:
   - **PATCH (`0.1.x` → `0.1.x+1`)**: Bug fixes, UI/UX polish, CSS styling/animation tweaks, performance optimizations, or edge-case handling.
   - **MINOR (`0.x.0` → `0.x+1.0`, resetting patch to 0)**: New workflow capabilities, node types, built-in recipes/templates, wiring validations, or non-breaking serialization formats.
   - **MAJOR (`x.0.0` → `x+1.0.0`, resetting minor and patch to 0)**: Incompatible graph schema changes, complete canvas engine rewrites, or formal graduation out of BETA to stable 1.0.0.
3. **Pre-Commit Workflow**:
   - Update `QUEUE_WORKFLOW_VERSION` in `version.ts`.
   - Update the version test in `src/renderer/features/workflow/workflow.test.ts`.
   - Verify tests and linting (`npm test`, `npm run lint`).
   - Stage and commit with the appropriate Conventional Commit scope (e.g. `fix(queue): ...` for patch, `feat(queue): ...` for minor).

### Hermano Copilot & Tool Decision Router Contract (`ChatbotWidget.tsx`, `chatbot.ts`)

1. **Presentation & Widget Standard**:
   - **Floating Trigger Orb**: Docked bottom-right (`fixed bottom-9 right-6 z-40`, 12px above StatusBar). Renders `<ThinkingOrb size={32} theme="dark" />` inside a comfortable dark frosted button. No distracting pulsing dots when closed.
   - **Modal Window**: Non-draggable modal docked bottom-right (`w-[390px] sm:w-[420px] h-[530px]`), dark-only glass styling matching `DESIGN.md`.
   - **Central Thinking Orb**: Hand-tuned 64px `<ThinkingOrb size={64} theme="dark" />` placed prominently in the center of the widget body (both in the empty greeting state and during the thinking/routing state). Never crammed into the top header bar.
   - **Keyboard Navigation**: `Ctrl + /` globally toggles Hermano; `Escape` closes it; `Enter` sends the query.
   - **Canonical Header Badge**: Uses standard `ROUTER · BETA` pill (`text-amber-400 bg-amber-500/15 border-amber-500/30`).
2. **Modular Architecture & Boundary Isolation**:
   - `ChatbotWidget.tsx` is strictly a presentation component; it consumes `useChatbot` from `src/renderer/stores/chatbot.ts`.
   - The decision routing logic (`routeQueryToTools` or future decision engine service) must remain completely decoupled from the UI. Swapping the decision backend (e.g. local ONNX embeddings, local SLM, or future Jev decision API) must never require altering `ChatbotWidget.tsx`.
3. **Problem Routing vs. Keyword Search Distinction**:
   - Hermano is **not** a search bar; fuzzy keyword search already exists in Command Palette (`Ctrl+K`).
   - Hermano's core responsibility is **intent classification**, **multi-step pipeline synthesis** (connecting to Queue Workflow), and **parameter pre-configuration** from user problem statements, adhering strictly to the semantic profiles, confidence tiers, and ambiguity clusters defined in `TOOL_ROUTING.md`.
   - Output tool cards must be clean and actionable: showing tool icon, title, category, concise rationale, and direct `[Open Tool]` navigation, without distracting confidence percentage clutter.
4. **Local-First & Privacy Policy**:
   - Router operations default to 100% offline local processing (zero cloud telemetry, zero remote prompts).
   - If an optional cloud decision model (e.g. Jev API) is supported in the future, it must be strictly opt-in via Settings, require explicit user API keys, and fail gracefully to the local engine when offline.
5. **Decision Engine & Model Architecture (Laya System 1)**:
   - Researched and established ConvAI Laya (~421M ModernBERT non-autoregressive decision model via `@receptron/laya` / ONNX Runtime) as the primary offline decision architecture.
   - **Deferred Implementation**: Do NOT implement or bundle model weights until the specific quantization model (INT8 ~450MB vs INT4 ~250MB vs FP16) is finalized by the user/team to preserve installer and disk discipline.
   - When implemented, model asset weights will hook into the 1-click on-demand dependency downloader under `resources/models/` following the zero-bloat principle.


## Agent behavior

Before substantial implementation:

1. Read `PRD.md`.
2. Read `DESIGN.md`.
3. Read `ARCHITECTURE.md`.
4. Read `TOOL_SPEC.md`.
5. Read `DECISIONS.md`.
6. Read `PROGRESS.md` and `TASKS.md`.
7. Read `GREPLOOP.md`.
8. Consult relevant skills under `.agents/skills/` (e.g. UI/UX intelligence, document/media processing, design system tokens, `greploop`).
9. Follow `GREPLOOP.md` / `LOOP.md` and leverage specialized subagents under `.agents/agents/`.

After implementation:

- run the narrowest relevant tests first;
- run the broader verification suite before declaring completion;
- execute the inspection loop (`GREPLOOP.md`) until a clean 5/5 score is achieved;
- update `TOOL_CATALOG.md` and `TOOL_SPEC.md` whenever tools are added or modified;
- update the root `README.md` in the same change whenever a tool is added, removed, renamed, recategorized or materially changed: reconcile headline/badge/catalog/category/shortcut counts against `src/renderer/tools/index.ts`, add or revise its catalog entry, preserve BETA labels, and document prerequisites and known limitations. Update feature sections when Queue Workflow or other user-facing behavior changes; never describe simulated execution as real processing. Verify local Markdown links and catalog totals before committing. This is a required agent checklist step, not an automatically executed hook;
- verify and register tool compatibility/incompatibility in the Queue Workflow engine (`execution.ts`) and add test coverage in `workflow.test.ts` whenever tools are added or modified;
- if the tool introduces or modifies an external binary, native C++ binding, AI model file, or runtime daemon, register it in the dependency scanner (`dependencies.ts`) and update test assertions in `dependencies.test.ts`;
- update `PROGRESS.md` and `TASKS.md`;
- record meaningful architectural decisions in `DECISIONS.md`;
- never mark a task complete without evidence.

## Inspection loop (greploop skill)

Use when:
- I finish a small feature, bugfix, or refactor
- I'm about to call something "done" or open a PR

Do:
- Run /greploop on the current changes (or `/greploop <PR#>` for a specific pull request) following `GREPLOOP.md`
- Let the reviewer panel score the diff out of 5
- Apply every blocking and major finding
- Re-review from a clean context, up to 5 iterations, until the score hits 5/5 with no blockers
- Keep diffs SMALL - greploop only converges on chunks that fit one clean review window
- Leverage the specialized subagents under `.agents/agents/` (`@verifier`, `@architecture-reviewer`, `@design-reviewer`, `@ui-reviewer`, `@ux-reviewer`)

Don't:
- Run greploop on a 1000-line change and expect 5/5
- Skip the loop "because it looked clean" - let it score

## Skills and specialized subagents

### Available Skills (`.agents/skills/`)
Leverage the installed project skills in the Antigravity workspace when implementing features or reviewing quality:
- **Code Review & Quality Loops:**
  - `greploop`: Automated iterative code and architecture inspection loop with orthogonal reviewer lenses.
- **UI / UX & Frontend Intelligence:**
  - `taste-skill` / `gpt-tasteskill`: Anti-slop frontend engineering, layout variance, and polished micro-interactions.
  - `ui-ux-pro-max` / `ui-styling` / `design-system`: Searchable UI styles, color palettes, font pairings, and accessibility / UX guidelines.
  - `awesome-design-md`: 73+ curated reference design systems (`design-md/`) for high-craft UI styling and component structure.
  - `frontend-design`: Distinctive visual design direction, typography hierarchy, and non-templated layouts.
  - `minimalist-skill`, `soft-skill`, `brutalist-skill`, `redesign-skill`: Specialized visual styling and refactoring workflows.
- **Document & Media Processing:**
  - `pdf`, `docx`, `pptx`, `xlsx`: Native scripts and extraction/manipulation techniques for document tools.
  - `canvas-design`: Static graphics, visual assets, and canvas rendering.
- **Testing & Tool Building:**
  - `webapp-testing`: End-to-end testing and component verification patterns.
  - `mcp-builder`, `skill-creator`: Integration and extension tooling.

### Specialized Subagents (`.agents/agents/`)
Invoke specialized subagents for focused planning, building, and review tasks:
- `@architecture-reviewer`: Reviews boundaries, IPC security, modularity, and scalability against `ARCHITECTURE.md`.
- `@design-reviewer`: Evaluates visual hierarchy, typography, surfaces, and dark palette compliance against `DESIGN.md`.
- `@ui-reviewer`: Inspects interaction feel, keyboard navigation, loading/error states, and accessibility against `VERIFY.md`.
- `@ux-reviewer`: Reviews end-user task flows, error recovery, and friction points.
- `@tool-builder`: Implements modular vertical slice tools following `TOOL_SPEC.md`.
- `@verifier`: Independently verifies test results, builds, and challenges unverified completion claims.

## Design guardrails

Avoid:

- generic SaaS landing-page layouts;
- excessive glassmorphism;
- neon gradients;
- giant hero headings;
- excessive rounded cards;
- meaningless decorative blobs;
- "AI tool" visual clichés;
- rainbow category colors;
- animations on every interaction.

Prefer:

- strong typography;
- a restrained neutral palette;
- one subtle accent;
- clear active states;
- compact but breathable tool panels;
- intentional borders and elevation;
- excellent drag/drop feedback;
- useful empty states;
- keyboard-friendly navigation.

## Git policy and commits

To maintain a clean, reliable, and transparent project history:

1. **Commit and push after meaningful milestones:** The agent must stage, commit, and push after completing meaningful changes or tasks throughout the build phases in `TASKS.md`.
2. **Conventional Commits format:** All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification using standard types (e.g., `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`, `style:`), optionally with a scope (e.g., `feat(pdf-merge):`, `fix(ipc):`, `docs(contract):`).
3. **Concise one-liner messages:** Commit messages must be written as a concise, descriptive one-liner summary (e.g. `feat(tools): implement base tool registry and contract`).
4. **Verified state only:** Only commit once the narrowest relevant tests and verification checks have passed. Never commit broken builds or unverified WIP code.
5. **Clean working tree:** Avoid committing unnecessary temporary artifacts, scratch files, or sensitive credentials.

## Scope discipline

When a new feature is requested:

1. determine whether it belongs in the current milestone;
2. add it to `TASKS.md` if it does;
3. otherwise record it as a future candidate;
4. do not silently expand the MVP.

The project is expected to grow for a long time. Architectural consistency is more valuable than rushing individual features.
