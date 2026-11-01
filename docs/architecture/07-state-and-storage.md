# 7. State and Storage

## In-memory session state (`src/state/`)

Per open document URI:

- **Walkthrough:** id, provider, model, settings used, created time, prompt version, target range, overview, steps (index, title, ranges, explanation, concepts, anchored flag, changed flag), summary, watch list, status (`streaming`, `done`, `stopped`, `failed`, `truncated`), usage.
- **Focus:** focused step index or none.
- **Threads:** id, range, turns (role, text, provider/model), status.

A small event emitter notifies the inline threads, CodeLens, and decorations. State is plain data so it can be serialized to the cache.

## Range tracking (ADR-0019)

`state/rangeTracker.ts` listens to `workspace.onDidChangeTextDocument` and shifts every tracked range (step ranges, thread ranges) using the content changes:

- Edits fully above a range shift it by the line delta.
- Edits inside a range mark the owning step as changed and adjust the end line.
- Edits that delete the whole range mark it changed and collapse it to the edit position.

Pure logic in a function `applyChanges(ranges, changes)`; unit tested with fixture edit sequences.

## Persisted cache (`src/cache/`)

- Location: `context.storageUri` (per workspace) under `logiclens-cache/`, or `globalStorageUri` for files outside any workspace.
- One JSON file per document and settings combination, named by a SHA-256 of the cache key. Key: document URI, provider, model, depth, audience, jargon, personality and pack version, explanation language, prompt version.
- Stored content: the walkthrough and threads, plus the exact text of each step's original lines (needed for re-anchoring) and a hash of the whole target text. Lines withheld by the secret scan are stored as SHA-256 hashes, never as text (ADR-0020); re-anchoring compares hashes for those lines.
- **On reopen:** if the target hash matches, load as is. If not, re-anchor each step by searching for its original lines (exact match first, then whitespace-insensitive, nearest to the old position). Steps not found are marked changed.
- Size cap 50 MB per workspace, LRU eviction by last-opened time kept in an index file.
- Writes are debounced and atomic (write temp, rename).
- `logiclens.cache.enabled = false` disables reads and writes; "Clear Cache" deletes the folder.

The cache contains user code excerpts. It lives in VS Code's per-user extension storage, never in the workspace folder, so it is not committed by accident.

Re-anchoring lives in `state/reanchor.ts` so the cache and bookmarks share one tested implementation.

## Bookmarks (`src/bookmarks/`, ADR-0022)

- One file, `bookmarks.json`, beside the cache folder in the same storage location; atomic writes.
- Per bookmark: id, kind (`step`, `answer`, `code`), document URI, ranges, original line text (hashes for withheld lines), explanation Markdown copy, question text for answers, note, provider, model, created and updated times, changed flag.
- Ranges are tracked live by the range tracker and re-anchored on open.
- Not touched by `logiclens.cache.enabled`, eviction, or Clear Cache. Cap 500.

## Workspace state (`context.workspaceState`)

- `trail`: entries (URI, symbol name, position, focused step index, scroll top line) and the current index (S10, ADR-0021). No code text.

## Global state (`context.globalState`)

- `termsAccepted`: `{ version, acceptedAt }` for `TERMS.md` (ADR-0024). Not cleared by Reset Data Notices.
- `dataNotice.<providerId>`: acknowledgement timestamp.
- `lastProvider`, `lastModel` for `auto` tie-breaking.
- `onboardingShown`.

## Secrets (`context.secrets`, S7)

No secrets are stored until S7 adds the API-key providers (ADR-0025).

- `logiclens.anthropic.apiKey`, `logiclens.openai.apiKey`.
- Set through `logiclens.setApiKey` (input box with `password: true`), validated with a cheap model-list call, never echoed.
- Deleted by an action in the provider picker.
