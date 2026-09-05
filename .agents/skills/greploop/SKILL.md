---
name: greploop
description: Automated code-review loop. Each pass dispatches a PANEL of fresh strict-reviewer subagents (correctness / security+contracts / quality-gates) that read the changed files in full, score the diff 1-5 with findings, and the main agent applies the fixes - re-reviewing from clean context until the panel agrees 5/5 with zero blocking/major findings, or 5 iterations max. Use when the user says "/greploop", "review loop", "loop until 5/5", "auto-fix this PR", or wants a PR/branch driven to a clean review without leaving the terminal. No external review service required - the reviewers are local Claude subagents.
---

# greploop - local review loop (no paid reviewer)

A self-hosted take on greptile/CodeRabbit-style review. Same iterate-to-clean loop, but
instead of calling a paid API for the score, a PANEL of fresh Claude reviewer subagents
scores the diff each pass. You are on a flat subscription, so re-reviewing and running
several reviewers in parallel costs nothing - lean on it. That free ensemble is what makes
this MORE robust than one reviewer, not less: one reviewer has one blind spot; orthogonal
lenses don't share it.

Pairs with **scanloop**: scanloop runs the deterministic catch (gitleaks secrets, semgrep
SAST, osv-scanner dep CVEs) on the diff first. greploop is the LLM-JUDGMENT layer - it does
NOT re-implement that scanning; it treats any scanloop finding as a pre-seeded blocking item.

## The two roles (never blur them)

- **Reviewer panel** = fresh subagents dispatched with the `code-reviewer` type (fall back to
  `general-purpose`). They ONLY read code and return a verdict - they NEVER edit files. A new
  panel is spawned every iteration so each review starts from a clean context: this keeps the
  score honest instead of a reviewer rubber-stamping its own earlier opinion.
- **Fixer** = you, the main agent. You apply the fixes, maintain the finding ledger across
  iterations, and run the merge. You never score your own work. The merge is mechanical, not a
  sixth opinion.

## Step 0 - Resolve the target

1. PR mode (`/greploop 80`): `gh pr checkout <n>`; the diff is `git diff <base>...HEAD` where
   base = `gh pr view <n> --json baseRefName`.
2. Local mode: diff against the default branch. Resolve it in order - (a) `git symbolic-ref
   --short refs/remotes/origin/HEAD` then strip `origin/`; (b) if that fails, test which of
   `main`/`master`/`develop` exists via `git rev-parse --verify`; (c) if still ambiguous, STOP
   and ask. Never assume `main`. Then sanity-check the captured diff is non-empty - an empty
   diff means the base is wrong; stop and re-resolve.
3. Dirty working tree: **default to committing the in-scope change on the current branch.**
   NEVER `git stash` in a shared / monorepo working tree (one repo holding many projects, e.g.
   `D:\ClaudeCode`) - stash reverts every project's uncommitted work and `pop` can fail to
   restore it. If unrelated changes are mixed in and you cannot commit cleanly, STOP and ask how
   to isolate. Never review a mix of committed + uncommitted noise.
4. Exclude non-reviewable paths from the captured diff (they blow context and waste findings):
   lockfiles (`*-lock.json`, `*.lock`), generated/build output (`dist/`, `build/`), minified
   bundles, binaries, DB files. Use a pathspec, e.g.
   `git diff <base>...HEAD -- . ':(exclude)package-lock.json' ':(exclude)dist/'`.
5. Size check: if the diff exceeds ~400 changed lines or ~15 files, do NOT start - report the
   size and recommend splitting; proceed only if the user explicitly says to. A diff too big for
   one clean context never reaches 5/5 (see "Why it stays small").
6. Capture the diff once at the top of each iteration (it changes as you fix).

## Step 1 - Load review criteria

Read the nearest `CLAUDE.md` (project + user global) and extract every hard rule the reviewer
must enforce - e.g. no emdash, no emoji in UI, no hardcoded colors, Phosphor-only icons,
anti-slop card patterns, tests must stay green. Pass these to the panel as MUST-CHECK items. A
finding that violates a stated house rule is always `blocking`.

## Step 1.5 - Finding ledger (you, the fixer, own this across iterations)

Keep a running table for the whole run: `finding -> iteration raised -> how fixed -> status
(open|resolved|disputed)`. Because each reviewer panel is fresh and has no memory, this ledger
is the only thing that catches (a) a fix that silenced a symptom instead of the root cause and
(b) a finding that regressed in a later pass. Hand the ledger to every new panel as
"PREVIOUSLY-RAISED - confirm each is still genuinely resolved at its root; re-flag any that
regressed." The loop cannot exit while any ledger row is `open`.

## Step 2 - The loop (max 5 iterations, panel review)

For iteration `i` from 1 to 5:

1. **Review (panel of 3, in parallel).** Dispatch all three in ONE message so they run
   concurrently. Each gets the same captured diff, the changed-file PATHS, the MUST-CHECK rules,
   the ledger, and a DIFFERENT lens. **Every reviewer must, before scoring: read each changed
   file in FULL (not just the hunk), and `grep` the repo for callers/importers of any
   changed/removed/renamed symbol** - a diff alone hides cross-file regressions. Lenses:
   - **R1 Correctness & regressions** - logic errors, edge cases, off-by-one, null/undefined,
     error & failure handling, state leaking across layers, races, and dead callers of anything
     removed/renamed.
   - **R2 Security & contracts** - authz / IDOR / broken access control, business-logic abuse,
     injection beyond scanloop's reach, API / type / DB-response contract drift, backward-compat.
   - **R3 Quality gates** - performance footguns (N+1, work in loops, O(n^2)), test coverage of
     the change (added or updated, not weakened to pass), and EVERY MUST-CHECK house rule.
   Each reviewer scores ONLY through its lens and returns strict JSON:
   ```json
   {
     "lens": "correctness|security|quality",
     "score": 1-5,
     "summary": "one line, incl. which callers/files you opened",
     "findings": [
       {"severity": "blocking|major|minor", "file": "path:line",
        "issue": "what's wrong", "fix": "concrete change to make"}
     ]
   }
   ```
   Each reviewer must enumerate ALL findings it sees, not stop at the first blocker. If a
   reply isn't parseable as this shape, re-dispatch that one reviewer once with "return ONLY the
   JSON object"; if it fails again, STOP and surface the raw output - never treat an unparseable
   review as a pass.
2. **Merge (mechanical - you do this, no new subagent).** Findings = union, deduped (same issue
   within +/-2 lines of the same `file:line`); on a dup keep the clearest `fix` and set severity
   = MAX across reviewers. Findings raised by 2+ lenses are `[consensus]` - fix first. Panel
   score = MIN of the three.
3. **Validate before fixing.** For each `blocking`/`major`, confirm it against the real code
   (read the lines, trace the logic, or write a quick failing test) BEFORE editing. Apply only
   confirmed findings; mark any you cannot reproduce `disputed` in the ledger and do NOT edit on
   it - a wrong `fix` field applied blindly injects real bugs. Disputed items don't block exit
   but are reported.
4. **Check exit.** STOP success only when ALL hold: merged findings have zero `blocking` and
   zero `major`; no ledger row is still `open`; no reviewer scored <= 3; and at least 2 of 3
   reviewers scored 5. A lone 5 never ends the loop. (Minor/nits never block - report, don't
   loop on taste.)
5. **Fix.** Apply confirmed `blocking`/`major` findings, `[consensus]` first. Smallest change
   that resolves each - surgical, no drive-by refactors. Update the ledger.
6. **Verify.** Run what the repo provides: `npx tsc --noEmit`, lint, the test script. A fix that
   breaks the build is not a fix - resolve before continuing. **If the repo provides NO
   build/lint/test gate, say so explicitly and treat the change as UNVERIFIED** - the panel score
   is then a code-read only; never claim "verified"/"tests pass" when nothing ran, and cap the
   reported confidence at 4 with "untested - manual verification needed". At minimum confirm the
   changed files still parse.
7. **Commit.** Atomic commit describing what this pass fixed (nothing fixed = nothing to commit;
   that's a valid clean exit). Re-capture the diff and continue. In PR mode, push ONCE after the
   loop ends, not every pass (avoids 5 noisy CI runs); local mode commits only (push if asked).

If iteration 5 ends without meeting the exit condition, STOP. Do not exceed the cap.

## Confidence rubric (give this to every reviewer)

- **5/5** - Ships. Correct, no bugs, follows house rules, no security/perf footguns, tests cover
  the change, no broken callers.
- **4/5** - Solid but a minor issue or a missing edge case / test.
- **3/5** - Happy-path only; a real bug, a missing guard, a broken caller, or a house-rule
  violation.
- **2/5** - Broken or unsafe in a common case; logic error, unhandled failure, leaked domain
  state across layers.
- **1/5** - Does not work, or introduces a security hole / data loss / crash.

Each reviewer scores the WORST material problem WITHIN ITS LENS, not an average and not problems
outside its lens. These anchors describe outcomes, not a substitute for actually reading the
files and callers - a 5 is only valid after the full-file + caller check. The panel score is the
MIN across lenses, so one blocking bug in any single lens caps the whole verdict at 2.

## Why it stays small

The loop only converges if each diff is small enough for THREE reviewers to each hold in one
clean context. A 9k-line PR will never hit 5/5 - the reviewers (same finite context as everyone
else) can't hold it all. If the diff is huge, split before looping (Step 0.5) - don't burn five
iterations on something un-reviewable.

## Why a panel, not one reviewer

One reviewer is one noisy sample with one blind spot - a clean 5/5 from it is weak evidence.
Three orthogonal lenses don't share a blind spot, so a whole bug class (an authz hole the
correctness lens skims past) still gets caught, and the exit gate (2-of-3 at 5, none <= 3) means
no single lucky 5 ships. Diversity comes from different LENSES (deterministic, reproducible), not
temperature jitter. Cost is free on a flat subscription; the real ceiling is coordination, so
keep diffs small and require JSON-only replies. It is still LLM judgement, not proof - only an
actual run earns the word "verified".

## Final report

When the loop ends, print:
- mode (local branch / PR #n), iterations run, panel size
- final merged score + per-lens scores, and whether the change was verified or UNVERIFIED
- fixed this run: resolved findings (from the ledger)
- remaining: minor findings left, disputed findings, or - if you bailed at the cap - the open
  blocking/major items and why they resisted fixing
- next: e.g. "ready to merge" / "needs manual decision on X" / "split the PR" / "verify manually"
