# Hermanos Stash — Autonomous Development Loop

This is the default operating procedure for long-running OpenCode sessions.

## Objective

Continue making verified, meaningful progress toward the current milestone without waiting for the user after every small implementation step.

The agent should behave like a small engineering team: plan, implement, inspect, test, review, fix, and record.

## Loop

### 1. Orient

Read:

- `AGENTS.md`
- `PRD.md`
- `DESIGN.md`
- `ARCHITECTURE.md`
- `TOOL_SPEC.md`
- `TASKS.md`
- `PROGRESS.md`
- `DECISIONS.md`
- `GREPLOOP.md`
- Relevant skills in `.agents/skills/` (UI/UX, document/media processing, design systems, `greploop`)

Inspect the current repository before making assumptions.

### 2. Select work

Choose the highest-priority incomplete task that is:

- within the current milestone;
- unblocked;
- small enough to verify;
- valuable toward a working product.

Do not start five unrelated features simultaneously.

### 3. Plan

For non-trivial work:

- identify affected modules;
- identify relevant existing patterns;
- consult relevant skills in `.agents/skills/` (e.g. `ui-ux-pro-max`, `awesome-design-md`, `pdf`, `docx`, `greploop`, etc.);
- define acceptance criteria;
- identify tests and verification needed.

If the work changes architecture or a project-wide convention, consult the architecture reviewer (`@architecture-reviewer`).

### 4. Implement

Implement the smallest complete vertical slice.

For a new tool, consult `@tool-builder` and follow:

`registry → input → processing → result → UI states → error handling → tests`

Leverage the document/media/UI skills in `.agents/skills/` rather than reinventing difficult formats or building generic UIs.

Do not build fake integrations.

### 5. Verify immediately

Run:

- type checking (`npm run typecheck`);
- linting (`npm run lint`);
- formatting check (`npm run format:check`);
- focused unit tests (`npm test`);
- focused tool tests;
- build checks where relevant.

Fix failures before moving on.

### 6. Review (Greploop)

Execute the inspection loop (`GREPLOOP.md` / `greploop` skill):
- Capture small diff (<400 lines);
- Score through the 3 orthogonal lenses (correctness, security, quality);
- Use specialized subagents under `.agents/agents/`:
  - `@architecture-reviewer`
  - `@design-reviewer`
  - `@ui-reviewer`
  - `@ux-reviewer`
  - `@verifier`
- Fix blockers and major findings, re-running the loop until a clean 5/5 score is achieved.

For visual work, inspect the actual running application rather than trusting source code alone.

### 7. Fix

Address clear review findings immediately when they are within scope.

Do not endlessly polish a completed task while other milestone work is blocked.

### 8. Record and Commit

Update:

- `TASKS.md`
- `PROGRESS.md`
- `DECISIONS.md` if a meaningful decision was made

Record evidence, not vague statements.

Commit and push verified changes following the Git policy in `AGENTS.md` (concise one-line Conventional Commit message, e.g. `feat(scope): ...`).

### 9. Continue

If the milestone still has unblocked work, continue automatically.

Stop and ask the user only when:

- a product decision genuinely cannot be inferred;
- destructive behavior requires approval;
- required external software is unavailable;
- a task conflicts with the PRD;
- verification reveals a problem that cannot reasonably be resolved.

## Definition of done

A task is not done because code exists.

It is done when:

- the intended behavior works;
- relevant states are handled;
- tests exist where practical;
- no obvious regression is introduced;
- UI is consistent with `DESIGN.md`;
- verification has passed;
- project records are updated.

## Recovery

If stuck:

1. reproduce the problem;
2. inspect logs/errors;
3. reduce to the smallest failing case;
4. search existing code for a known pattern;
5. use a specialized subagent;
6. try a second implementation approach;
7. document the blocker if still unresolved.

Never repeatedly make speculative edits without learning from the previous attempt.
