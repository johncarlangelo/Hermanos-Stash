---
description: Continue Hermanos Stash toward the current goal using the autonomous project loop
agent: build
---

Read AGENTS.md, LOOP.md, PRD.md, DESIGN.md, ARCHITECTURE.md, TOOL_SPEC.md, TASKS.md, PROGRESS.md, DECISIONS.md, and VERIFY.md.

Act as the primary implementation agent for Hermanos Stash.

Determine the highest-value incomplete task in the current milestone, implement it as a complete vertical slice, verify it, fix failures, and update the project records.

Continue through additional unblocked tasks without asking for confirmation between ordinary implementation steps.

Use specialized subagents when their expertise would materially improve the result.

Do not expand scope beyond the current milestone unless a dependency makes it necessary.

Do not stop merely because one task is complete if there is more unblocked work that can be safely completed.

Stop only when the current goal is complete, a genuine blocker requires user input, or verification cannot reasonably proceed.

$ARGUMENTS
