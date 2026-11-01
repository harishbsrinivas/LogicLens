# S8. Cache and Staleness

**Status:** In progress: implemented on `s8-cache-and-staleness` (stacked on `s3-more-targets-and-controls`); unit and integration tests pass with a fake provider. Exit check open: the demo script needs a person (window reloads, git pull).
**User value:** reopening a file shows its walkthrough instantly, without a new request. When the code changes, LogicLens keeps what still applies, marks what changed, and refreshes only the changed steps on request.
**Spec:** §10 (caching and staleness), §5 (thread lifetime), §2 J6

## Scope

In:
- Full range tracker (arch §7) for steps and threads, replacing the S4 simple shift.
- Changed-step marking and walkthrough **Stale** badge.
- **Refresh** (full) and **Refresh changed steps** (prompt `refreshSteps` v1).
- Persisted cache in workspace storage: write on completion, debounced; atomic writes; LRU cap; index file.
- Re-anchoring on reopen by original text match.
- Threads persisted and restored with their documents.
- `logiclens.cache.enabled`, `logiclens.clearCache`.
- "Generated <time> by <provider/model>" in the explanation thread's header line.

## Tasks

- [x] `state/rangeTracker.ts` with fixture edit sequences (insert above, inside, delete across, multi-cursor edits, undo).
- [x] `cache/` store with unit tests (key derivation, LRU, corruption recovery: a bad file is deleted and ignored).
- [x] Re-anchoring algorithm with tests (exact, whitespace-insensitive, moved block, deleted block).
- [x] Refresh-changed-steps flow, parser mapping by step number.
- [x] Integration tests: reload (simulated by dropping in-memory state and restoring) keeps walkthrough and threads; changed text on restore marks changed steps; clear cache removes entries; Close Explanation removes the entry.

## Demo script

1. Explain a file; close VS Code; reopen; open the file. Walkthrough appears instantly with "Generated 2 min ago by …".
2. Edit inside step 3; step 3 shows "code changed"; header shows Stale.
3. Click **Refresh changed steps**; only step 3 is regenerated.
4. `git pull` a change that moves a function down 20 lines; reopen; the step follows the moved code.
5. Turn off `logiclens.cache.enabled`; reload; nothing is restored.

## Progress notes

- 2026-11-01: integration tests cannot reload the window, so `TestApi.dropState` forgets a document's state in memory (and its pending save), and `TestApi.cache.restore` runs the reopen path. A changed document before restore stands in for an outside edit.
- Close Explanation removes the cached entry; otherwise it would come back on reopen. Closing the file keeps it.
- Restore picks the newest entry for the document, whatever the current settings (the key still separates settings combinations, ADR-0019).

## Exit check

- [ ] Demo script passes.
- [ ] Cache files appear only under VS Code's extension storage, never in the workspace.
- [x] All tests green (local: unit and integration, VS Code 1.90.0, Linux).
