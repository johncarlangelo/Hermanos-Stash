# Hermanos Stash — Greploop Inspection Protocol

Automated, rigorous code-and-design review loop adapted for Hermanos Stash and the Antigravity IDE.

## Purpose

Every change—whether a new tool, bugfix, UI refinement, or refactor—must pass through an objective inspection loop before it is declared complete or committed to Git. The agent applying fixes must never rubber-stamp its own work.

---

## When to Run

- Immediately after implementing any feature, tool slice, bugfix, or refactor.
- Whenever preparing to mark a task `[x]` in `TASKS.md` or `PROGRESS.md`.
- Before staging and pushing commits to `main`.
- When the user issues `/greploop` or requests a review loop.

---

## The Roles

1. **Reviewer Panel (Subagents):**
   - Evaluates the diff objectively using focused orthogonal lenses.
   - Reads files in full and checks callers across the repo.
   - Returns a structured score (1–5) and categorized findings.
   - **Never edits code or applies fixes directly.**

2. **Fixer (Main Agent):**
   - Maintains the persistent **Finding Ledger** across review passes.
   - Applies concrete fixes to resolve every `blocking` and `major` finding.
   - Re-runs typechecks and tests.
   - Initiates the next clean review pass.
   - Never scores its own fixes.

---

## Specialized Subagent Reviewers (`.agents/agents/`)

When inspecting changes, dispatch or emulate the specialized subagents:

- **`@verifier`**: Runs `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`. Confirms tests pass with real evidence, challenges unverified claims.
- **`@architecture-reviewer`**: Audits main/preload/renderer boundaries, IPC channels (`src/shared/ipc.ts`), path security, and modularity.
- **`@design-reviewer`**: Enforces `DESIGN.md` guardrails: dark-only palette, no pure black, typography hierarchy (Playfair / Inter / JetBrains Mono), consistent dropzones, and restrained motion.
- **`@ui-reviewer`**: Audits keyboard accessibility, focus rings, ARIA labels, empty/loading/error states, and responsive spacing.
- **`@ux-reviewer`**: Verifies user workflows, drag-and-drop feedback, file validation notes, and export interactions.

---

## The 3 Review Lenses (`greploop` skill)

Each review pass inspects the diff through 3 orthogonal lenses:

1. **Lens 1: Correctness & Regressions**
   - Logic bugs, off-by-one errors, null/undefined handling.
   - Cross-file impact: grep for all callers/importers of changed symbols.
   - Error handling and edge cases.

2. **Lens 2: Security & Contracts**
   - Untrusted renderer input validation main-side.
   - Path traversal prevention, WriteScopeGuard compliance.
   - IPC type and response schema contracts.

3. **Lens 3: Quality & House Rules**
   - Compliance with `AGENTS.md`, `DESIGN.md`, and `TOOL_SPEC.md`.
   - Test coverage for newly added logic.
   - Formatting, linting, and zero TypeScript warnings.

---

## Finding Severities & Scoring

| Severity | Definition | Policy |
| :--- | :--- | :--- |
| **Blocking** | Bugs, type errors, test failures, security flaws, architectural breaches, or house-rule violations. | Must be fixed before loop can exit. |
| **Major** | Missing edge-case handling, UX inconsistencies, performance traps, missing tests. | Must be fixed before loop can exit. |
| **Minor** | Optional polish, comment clarity, cosmetic formatting tweaks. | Fixed if within scope; does not block 5/5. |

### Scoring Standard (1–5):
- **5 / 5**: Zero blocking findings, zero major findings, all tests/typechecks pass, compliant with design guidelines.
- **4 / 5**: No blockers, but contains 1–2 major findings requiring remediation.
- **≤ 3 / 5**: One or more blocking issues found.

---

## The Loop Protocol (Max 5 Iterations)

```
Iteration 1..5:
  1. Capture Diff (keep small: < 400 lines)
  2. Dispatch Review Panel (Correctness, Security, Quality + Subagents)
  3. Score & Collect Findings into Ledger
  4. IF Score == 5/5 AND Zero Blockers/Majors:
       --> EXIT LOOP & PROCEED TO COMMIT
  5. ELSE:
       --> Fixer applies fixes to all blockers & majors
       --> Verify (typecheck, lint, test)
       --> Re-review from clean context (Iteration + 1)
```

---

## Golden Rules

- **Do**:
  - Keep diffs small (<400 lines / <15 files) so reviews can converge to 5/5 quickly.
  - Fix the root cause, not just the symptom.
  - Re-verify from a clean context so each pass is completely honest.
  - Maintain the Finding Ledger so previously resolved issues do not regress.

- **Don't**:
  - Never run greploop on a massive 1,000+ line diff and expect 5/5.
  - Never skip the loop "because the code looked clean"—always let the panel inspect and score.
  - Never claim a task complete without test evidence and a passing review score.
