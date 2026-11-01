# 14. Bookmarks

Users save code and its explanation to come back to later: a tricky step, a useful answer, a spot to revisit.

## What can be bookmarked

| Kind | Created from | Saved with it |
|---|---|---|
| **Step** | "Bookmark" on a walkthrough step's title row, or in the step thread's title | Step title, ranges, explanation, concepts |
| **Answer** | "Bookmark Answer" in an answer's comment menu | The question and the answer it belongs to |
| **Code** | **LogicLens: Add Bookmark** (`Ctrl+Alt+E M`) on a selection or the cursor line | Range only |

Every bookmark has an optional note, asked for in an input box when it is created (Enter with an empty box skips it; Escape cancels the bookmark), and records file, ranges, created time, and, for steps and answers, the provider and model that wrote the explanation.

A bookmark saves a **copy** of the explanation. It stays readable after the walkthrough is refreshed, the cache is cleared, or the provider is changed.

## Bookmarks view

A **Bookmarks** tree view in the LogicLens view container, grouped by file:

- Item label: the note if set, otherwise the step title, the question, or the first line of code.
- Description: `L12–20` and kind icon (step, comment, code).
- Selecting an item opens the file, reveals and highlights the range (same highlight as a focused step, spec §4), and shows the saved explanation inline under the range's first line as a read-only "Bookmarked explanation" thread with its date and model.
- Context menu: Edit Note, Copy as Markdown, Remove.
- View toolbar: collapse all, **Clear All Bookmarks** (asks for confirmation).
- Empty state: one line explaining how to add a bookmark.

Bookmarked lines show a small bookmark icon in the editor gutter while the file is open (unless a step number or lock icon already uses that line). A bookmarked step's title row shows "Bookmarked" instead of "Bookmark"; clicking it shows the bookmark. The bookmarked explanation thread has **Explain Again** and **Close** in its title.

## When code changes

Bookmark ranges move with edits while the file is open and are re-anchored on reopen with the same method as the cache (spec §10). A bookmark whose lines cannot be found keeps its saved explanation and shows **code changed**. Nothing is regenerated automatically; the bookmarked explanation thread offers **Explain again**, which is an explicit action (spec §8).

## Limits and privacy

- Bookmarks live in the extension's per-workspace storage on this machine, never in the repository, and are not sent anywhere.
- They are separate from the cache: `logiclens.cache.enabled` and **Clear Cache** do not affect them. **Clear All Bookmarks** deletes them.
- Files excluded by LogicLens settings (spec §8) cannot be bookmarked.
- Lines withheld by the secret scan (spec §8) are never stored as text in a bookmark.
- Up to 500 bookmarks per workspace; adding more asks the user to remove some first.
- If the bookmarks file cannot be read, it is kept beside the store as `bookmarks.json.corrupt` and LogicLens starts with no bookmarks rather than overwrite it.

Exporting bookmarks (for example as Markdown or a code tour) is a post-MVP candidate (spec §11).
