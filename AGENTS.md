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
- tests
- documentation/metadata

Do not couple individual tools directly to unrelated UI screens.

## Agent behavior

Before substantial implementation:

1. Read `PRD.md`.
2. Read `DESIGN.md`.
3. Read `ARCHITECTURE.md`.
4. Read `TOOL_SPEC.md`.
5. Read `DECISIONS.md`.
6. Read `PROGRESS.md` and `TASKS.md`.
7. Consult relevant skills under `.opencode/skills/` (e.g. UI/UX intelligence, document/media processing, design system tokens).
8. Follow `LOOP.md` and leverage specialized subagents under `.opencode/agents/`.

After implementation:

- run the narrowest relevant tests first;
- run the broader verification suite before declaring completion;
- update `PROGRESS.md`;
- record meaningful architectural decisions in `DECISIONS.md`;
- never mark a task complete without evidence.

## Skills and specialized subagents

### Available Skills (`.opencode/skills/`)
Leverage the installed project skills when implementing features or reviewing quality:
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

### Specialized Subagents (`.opencode/agents/`)
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
