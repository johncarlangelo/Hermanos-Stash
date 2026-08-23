# Hermanos Stash — Verification Protocol

## Before declaring any task complete

### Static checks

- [ ] TypeScript passes.
- [ ] Lint passes.
- [ ] Formatting passes where configured.
- [ ] No obvious dead imports or unused code.
- [ ] Build succeeds.

### Functional checks

- [ ] Happy path works.
- [ ] Invalid input is handled.
- [ ] Empty state is handled.
- [ ] Failure state is understandable.
- [ ] Cancellation works where promised.
- [ ] Outputs are actually valid.

### Desktop checks

- [ ] Application starts.
- [ ] Renderer cannot directly access privileged Node APIs.
- [ ] File picker works.
- [ ] Save/export works.
- [ ] Temporary files are cleaned up.
- [ ] Large files do not freeze the UI unnecessarily.

### UX checks

- [ ] Keyboard navigation works.
- [ ] Focus is visible.
- [ ] Buttons have clear states.
- [ ] Loading state communicates progress.
- [ ] Errors explain what the user can do.
- [ ] Design matches `DESIGN.md`.
- [ ] No accidental generic/AI-slop visual patterns were introduced.

## Tool verification

For every new tool:

1. Test normal input.
2. Test malformed input.
3. Test unsupported input.
4. Test boundary conditions.
5. Verify output.
6. Verify cleanup.
7. Verify history entry where applicable.
8. Verify search/category/tag registration.
9. Verify favorite behavior.

## Release gate

A milestone cannot be marked complete until:

- automated tests pass;
- build passes;
- core user flows have been manually inspected;
- no known blocker remains;
- `PROGRESS.md` contains evidence;
- `TASKS.md` is accurate.
