# 14. Bookmarks

Users save code and its explanation to come back to later: a tricky step, a useful answer, a spot to revisit.

## What can be bookmarked

| Kind | Created from | Saved with it |
|---|---|---|
| **Step** | Bookmark icon on a walkthrough step | Step title, ranges, explanation, concepts |
| **Answer** | "Bookmark" in a thread's comment menu | The question and the answer it belongs to |
| **Code** | **LogicLens: Add Bookmark** (`Ctrl+Alt+E M`) on a selection or the cursor line | Range only |

Every bookmark has an optional note, asked for in an input box when it is created (Enter skips it), and records file, ranges, created time, and, for steps and answers, the provider and model that wrote the explanation.

A bookmark saves a **copy** of the explanation. It stays readable after the walkthrough is refreshed, the cache is cleared, or the provider is changed.

## Bookmarks view

A **Bookmarks** tree view in the LogicLens view container, grouped by file:

- Item label: the note if set, otherwise the step title, the question, or the first line of code.
- Description: `L12–20` and kind icon (step, comment, code).
- Selecting an item opens the file, reveals and highlights the range (same highlight as a focused step, spec §4), and shows the saved explanation inline under the range's first line as a read-only "Bookmarked explanation" thread with its date and model.
- Context menu: Edit Note, Copy as Markdown, Remove.
- View toolbar: collapse all, **Clear All Bookmarks** (asks for confirmation).
- Empty state: one line explaining how to add a bookmark.

Bookmarked lines show a small bookmark icon in the editor gutter while the file is open. A step that is bookmarked shows a filled bookmark icon in its title CodeLens.

## When code changes

Bookmark ranges move with edits while the file is open and are re-anchored on reopen with the same method as the cache (spec §10). A bookmark whose lines cannot be found keeps its saved explanation and shows **code changed**. Nothing is regenerated automatically; the bookmarked explanation thread offers **Explain again**, which is an explicit action (spec §8).

## Limits and privacy

- Bookmarks live in the extension's per-workspace storage on this machine, never in the repository, and are not sent anywhere.
- They are separate from the cache: `logiclens.cache.enabled` and **Clear Cache** do not affect them. **Clear All Bookmarks** deletes them.
- Files excluded by LogicLens settings (spec §8) cannot be bookmarked.
- Lines withheld by the secret scan (spec §8) are never stored as text in a bookmark.
- Up to 500 bookmarks per workspace; adding more asks the user to remove some first.

Exporting bookmarks (for example as Markdown or a code tour) is a post-MVP candidate (spec §11).
