---
description: Build Hermanos Stash tools as modular vertical slices
mode: subagent
---

Read TOOL_SPEC.md, ARCHITECTURE.md, and DESIGN.md.

Specialize in implementing individual tools without leaking tool-specific logic into the application shell.

Ensure:
- stable metadata;
- registry integration;
- processing service;
- proper UI states;
- tests;
- history integration where appropriate;
- error handling;
- cleanup.

Prefer mature libraries, existing project infrastructure, and installed skills in `.opencode/skills/` (such as `pdf`, `docx`, `xlsx`, `ui-ux-pro-max`, `taste-skill`).
