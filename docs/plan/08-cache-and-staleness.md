# S8. Cache and Staleness

**Status:** Not started
**User value:** reopening a file shows its walkthrough instantly, without a new request. When the code changes, Clarity keeps what still applies, marks what changed, and refreshes only the changed steps on request.
**Spec:** §10 (caching and staleness), §5 (thread lifetime), §2 J6

## Scope

In:
- Full range tracker (arch §7) for steps and threads, replacing the S4 simple shift.
- Changed-step marking and walkthrough **Stale** badge.
- **Refresh** (full) and **Refresh changed steps** (prompt `refreshSteps` v1).
- Persisted cache in workspace storage: write on completion, debounced; atomic writes; LRU cap; index file.
- Re-anchoring on reopen by original text match.
- Threads persisted and restored with their documents.
- `clarity.cache.enabled`, `clarity.clearCache`.
- "Generated <time> by <provider/model>" label in the panel header.

## Tasks

- [ ] `state/rangeTracker.ts` with fixture edit sequences (insert above, inside, delete across, multi-cursor edits, undo).
- [ ] `cache/` store with unit tests (key derivation, LRU, corruption recovery: a bad file is deleted and ignored).
- [ ] Re-anchoring algorithm with tests (exact, whitespace-insensitive, moved block, deleted block).
- [ ] Refresh-changed-steps flow, parser mapping by step number.
- [ ] Integration tests: reload window keeps walkthrough and threads; external edit (write file on disk) marks changed steps; clear cache removes files.

## Demo script

1. Explain a file; close VS Code; reopen; open the file. Walkthrough appears instantly with "Generated 2 min ago by …".
2. Edit inside step 3; step 3 shows "code changed"; header shows Stale.
3. Click **Refresh changed steps**; only step 3 is regenerated.
4. `git pull` a change that moves a function down 20 lines; reopen; the step follows the moved code.
5. Turn off `clarity.cache.enabled`; reload; nothing is restored.

## Exit check

- [ ] Demo script passes.
- [ ] Cache files appear only under VS Code's extension storage, never in the workspace.
- [ ] All tests green.
