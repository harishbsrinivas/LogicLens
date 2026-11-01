# S11. Bookmarks

**Status:** Not started
**User value:** save a step, an answer, or a code range with a note, and come back to it later with its explanation, even after the walkthrough changed.
**Spec:** §14, §2 J8, §8 (local storage), §9

## Scope

In:
- Bookmark actions: step title CodeLens, "Bookmark" in thread comment menus, `logiclens.addBookmark` on selection or cursor line, optional note input.
- Store in `src/bookmarks/store.ts` per ADR-0022: atomic JSON, cap 500, separate from the cache.
- Shared re-anchoring module used by cache and bookmarks (move from `src/cache/` if S8 put it there).
- Bookmarks `TreeView` (`logiclens.bookmarks`) grouped by file; edit note, copy as Markdown, remove, clear all with confirmation; empty state.
- Selecting a bookmark: reveal and highlight range; a read-only "Bookmarked explanation" thread appears at the range with **Explain again**.
- Gutter bookmark icon; filled bookmark icon on bookmarked steps.
- "code changed" marking on failed re-anchor.
- Refuse bookmarking excluded files; store withheld lines as hashes only (ADR-0020).

Out: export (post-MVP), sync across machines, sharing.

## Tasks

- [ ] Store unit tests: add, edit, remove, cap, corrupt file recovery, atomic write.
- [ ] Re-anchoring tests reused from S8 against bookmark fixtures, plus withheld-line hash matching.
- [ ] Tree data provider with unit tests for grouping and labels.
- [ ] Message bridge additions (arch §6): `bookmarkStep`, `showBookmark`, `explainAgain`.
- [ ] Integration tests: bookmark survives Clear Cache and `logiclens.cache.enabled = false`; Clear All Bookmarks removes the file; excluded file refused; no provider request on any bookmark action except **Explain again**.
- [ ] Update arch §3, §6, §7 with anything that changed.

## Demo script

1. Explain a file; bookmark step 2 with the note "retry rule".
2. Ask a question at a line; bookmark the answer.
3. Select five lines in another file; Ctrl+Alt+E M with no note.
4. Open the Bookmarks view: three items grouped under two files.
5. Run Clear Cache, reload the window, select "retry rule": lines highlighted, saved explanation shown.
6. Delete the bookmarked lines in the editor, reload: the bookmark shows "code changed" and keeps its text.

## Exit check

- [ ] Demo script passes.
- [ ] Bookmarks file appears only under VS Code's extension storage, never in the workspace.
- [ ] All tests green.
