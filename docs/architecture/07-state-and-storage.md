# 7. State and Storage

## In-memory session state (`src/state/`)

Per open document URI:

- **Walkthrough:** id, provider, model, settings used, created time, prompt version, target range, overview, steps (index, title, ranges, explanation, concepts, anchored flag, changed flag), summary, watch list, status (`streaming`, `done`, `stopped`, `failed`, `truncated`), usage.
- **Focus:** focused step index or none.
- **Threads:** id, range, turns (role, text, provider/model), status.

A small event emitter notifies the panel, decorations, and comments. State is plain data so it can be serialized to the cache.

## Range tracking (ADR-0019)

`state/rangeTracker.ts` listens to `workspace.onDidChangeTextDocument` and shifts every tracked range (step ranges, thread ranges) using the content changes:

- Edits fully above a range shift it by the line delta.
- Edits inside a range mark the owning step as changed and adjust the end line.
- Edits that delete the whole range mark it changed and collapse it to the edit position.

Pure logic in a function `applyChanges(ranges, changes)`; unit tested with fixture edit sequences.

## Persisted cache (`src/cache/`)

- Location: `context.storageUri` (per workspace) under `clarity-cache/`, or `globalStorageUri` for files outside any workspace.
- One JSON file per document and settings combination, named by a SHA-256 of the cache key. Key: document URI, provider, model, depth, audience, explanation language, prompt version.
- Stored content: the walkthrough and threads, plus the exact text of each step's original lines (needed for re-anchoring) and a hash of the whole target text.
- **On reopen:** if the target hash matches, load as is. If not, re-anchor each step by searching for its original lines (exact match first, then whitespace-insensitive, nearest to the old position). Steps not found are marked changed.
- Size cap 50 MB per workspace, LRU eviction by last-opened time kept in an index file.
- Writes are debounced and atomic (write temp, rename).
- `clarity.cache.enabled = false` disables reads and writes; "Clear Cache" deletes the folder.

The cache contains user code excerpts. It lives in VS Code's per-user extension storage, never in the workspace folder, so it is not committed by accident.

## Global state (`context.globalState`)

- `dataNotice.<providerId>`: acknowledgement timestamp.
- `lastProvider`, `lastModel` for `auto` tie-breaking.
- `onboardingShown`.

## Secrets (`context.secrets`)

- `clarity.anthropic.apiKey`, `clarity.openai.apiKey`.
- Set through `clarity.setApiKey` (input box with `password: true`), validated with a cheap model-list call, never echoed.
- Deleted by an action in the provider picker.
