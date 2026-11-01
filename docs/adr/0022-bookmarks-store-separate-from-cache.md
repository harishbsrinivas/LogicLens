# ADR-0022: Bookmarks in extension storage, separate from the cache

- **Status:** Accepted (implemented in S11)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §14; arch §7

## Context
Users want to save a step, an answer, or a code range and return later. The cache (ADR-0019) is evictable, can be disabled, and is keyed by settings, so it cannot hold something the user chose to keep.

## Decision
- Store bookmarks in one JSON file, `bookmarks.json`, in `context.storageUri` (or `globalStorageUri` for files outside a workspace), written atomically.
- Each bookmark keeps a copy of its explanation Markdown, its ranges, the original line text for re-anchoring (SHA-256 hashes for lines withheld by the secret scan, ADR-0020), note, kind, provider, model, and timestamps.
- Re-anchor with the same algorithm as the cache; unmatched bookmarks are marked "code changed", never deleted or regenerated automatically.
- Not subject to `logiclens.cache.enabled`, LRU eviction, or Clear Cache. Capped at 500 per workspace. Cleared only by the user.
- Shown in a native `TreeView`, not in the webview.

## Alternatives considered
- Pin entries in the cache: eviction and Clear Cache would silently delete user data.
- Store in the workspace (`.logiclens/bookmarks.json`): shareable, but risks committing code excerpts and model output to git.
- VS Code's built-in or third-party bookmark extensions: no place for the explanation and not available everywhere.
- Bookmarks list inside the webview panel: duplicates tree navigation, keyboard handling, and accessibility that `TreeView` provides.

## Consequences
- A second store that holds code excerpts on disk; documented in spec §8 and §14 with its own clear command.
- Shared re-anchoring code moves to a module both stores use (arch §7).
