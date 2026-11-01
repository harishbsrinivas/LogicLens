# 7. State and Storage

## In-memory session state (`src/state/`)

Per open document URI:

- **Walkthrough:** id, provider, model, settings used, created time, prompt version, target range, overview, steps (index, title, ranges, explanation, concepts, anchored flag, changed flag), summary, watch list, status (`streaming`, `done`, `stopped`, `failed`, `truncated`), usage.
- **Focus:** `focus` (highlighted step, moved by follow mode), `opened` (step whose thread is expanded, changed only by an explicit focus), and `showAll`.
- **Raw response:** the model's text so far, sent back on Continue; never shown or logged outside the debug channel.
- **Threads:** id, range, turns (role, text, provider/model), status.

`SessionStore` has two events: `onDidChange` for structural changes (new walkthrough or step, status, focus, stale), which the inline threads, CodeLens, decorations, and context keys handle at once, and `onDelta` for streamed text, which the inline threads batch. State is plain data so it can be serialized to the cache.

## Range tracking (ADR-0019)

`state/rangeTracker.ts` (S8; S4's `rangeShift.ts` grown) is pure: `applyEdits(range, edits)` applies one change event's edits bottom-up and returns the new range plus `touched` and `deleted`:

- Edits fully above a range (ending before its first line, or at column 0 of it) shift it by the line delta.
- Edits inside a range are `touched`; line inserts or deletes adjust the end line.
- Edits that delete every line of the range mark it `deleted` and collapse it to the edit position.

`SessionStore.applyEdits` (called from `ui/stepContext.ts` on `onDidChangeTextDocument`) moves every step range, the target, and the withheld lines, marks touched or deleted steps `changed`, and marks the walkthrough stale. `ui/questionThreads.ts` does the same for question threads. Unit tested with fixture edit sequences (insert above, inside, delete across, multi-cursor, undo).

## Persisted cache (`src/cache/`)

- Location: `context.storageUri` (per workspace) under `logiclens-cache/`, or `globalStorageUri` for files outside any workspace.
- `cache/store.ts` (`CacheStore`, Node async fs only): one JSON file per document and settings combination, named by a SHA-256 of the cache key. Key: document URI, provider label, model label, depth, audience, jargon, personality (empty until S12), explanation language, walkthrough prompt version, and target range (empty for the whole file). `index.json` records each file's document URI, size, save time, and last-opened time. Operations run one at a time.
- Stored content (`cache/restore.ts` `buildEntry`, format 1): the walkthrough view (a streaming one is saved as stopped), the raw response (for Continue), question threads with finished turns only, and for re-anchoring the text of every step range, the target, and each thread's lines, plus a SHA-256 of the whole document. Lines withheld by the secret scan are stored as `sha256:` hashes, never as text (ADR-0020); re-anchoring compares hashes for those lines, and the lock icons are re-anchored by hash.
- **On reopen** (`cache/sync.ts` `CacheSync`, on `onDidOpenTextDocument` and for documents already open at activation): only `file` documents with no walkthrough or threads in memory; the newest entry for the URI is loaded whatever the current settings. If the document hash matches, it loads as is. If not, `restoreEntry` re-anchors each range with `state/reanchor.ts` (exact match first, then whitespace-insensitive, nearest the old position); steps and threads not found are marked changed and keep their old lines, clamped. A restored walkthrough is `restored`, and its header shows "Generated <age>".
- **Saving:** one second after the last session or thread change for an open `file` document, unless it is still streaming. A document with neither a walkthrough nor threads (Close Explanation, Clear Threads) has its entries removed; a closed document is not saved, so closing a file keeps its cache.
- Size cap 50 MB per workspace, LRU eviction by last-opened time. A file that does not parse, or has another format version, is deleted and ignored.
- Writes are atomic (write `<file>.<pid>.tmp`, rename).
- `logiclens.cache.enabled = false` disables reads and writes; **Clear Cache** deletes the folder.

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
