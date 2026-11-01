# ADR-0019: Local cache in extension storage with text-based re-anchoring

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §10; arch §7

## Context
Regenerating walkthroughs costs time and the user's quota. Code changes between sessions, so cached line ranges drift.

## Decision
Store walkthroughs and threads as JSON in VS Code's per-workspace extension storage, keyed by document, provider, model, settings, and prompt version. Store each step's original line text. Track ranges live against edits; on reopen, re-anchor by matching the original text (exact, then whitespace-insensitive, nearest position) and mark unmatched steps as changed. Cap at 50 MB per workspace with LRU eviction.

## Alternatives considered
- No cache: simplest, but slow and wasteful.
- Store in the workspace (for example `.logiclens/`): risks committing code excerpts and model output to git.
- Re-anchor with git diffs: needs git and fails for untracked files.

## Consequences
- Cache contains code excerpts on disk in user storage; documented in spec §8 and clearable.
