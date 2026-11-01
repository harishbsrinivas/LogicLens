# 6. UI Architecture

There is no webview. Explanations render inline in the editor with stable APIs only (ADR-0028, superseding ADR-0009).

## Inline explanation threads

`ui/inlineThreads.ts` owns the one `CommentController` (id `logiclens`, label "LogicLens"). It listens to the session store and renders each document's walkthrough as read-only threads (`canReply = false`).

- **S1:** one thread per document, anchored at line 1 (`Range(0,0,0,0)`), created expanded; visible editors of that document scroll to the top when it is created. Its single comment has author `LogicLens · <provider> · <model>`, `label` with the duration once finished, and a `MarkdownString` body: the withheld-lines notice (line numbers only), the explanation text, and a stopped or failed note.
- **S2:** the overview thread holds the overview (or the Markdown fallback with its notice), unanchored steps marked "not linked to lines", and a stopped, incomplete, or failed note; the summary and things to watch are a second comment with author "Summary". Each anchored step gets its own thread attached to `stepLine(start) = max(0, start − 2)` (0-based), the line before the step, so it shows just above its code (ADR-0029). Step threads are created `Collapsed`; a thread is `Expanded` when it is the session's `opened` step or `showAll` is on. Expansion is set only when that wanted state changes, so a thread the user opened or closed by hand stays that way. A Markdown fallback has no step threads.
- Step thread: `label` "N · Title", one comment with author "LogicLens", `label` with its ranges ("L5–8"), body with the explanation and concept tags as inline code.
- Overview `thread.label`: "Explaining <file>…" while streaming, the file name when done, "<file>: stopped", "<file>: incomplete" (truncated), or "<file>: failed"; " (file changed since)" is appended once the document is edited.
- `thread.contextValue` drives `comments/commentThread/title` menus: overview `streaming` (Stop), `finished` (Explain again), `continuable` (Continue and Explain again); Show All Steps and Close on any overview thread; step threads are `step` and have no title actions yet. Thread commands receive the thread and resolve its document from `thread.uri` among the visible editors.
- Streaming text arrives through `SessionStore.onDelta`; bodies are re-rendered at most about every 100 ms. Structural changes (new step, status, focus) re-render at once. Each thread keeps a signature of its label, context value, and comments and is left alone when nothing changed.
- A new walkthrough for the same document disposes the old thread; closing the document or **Close Explanation** deletes the session entry, which disposes its thread.
- Bodies pass through `ui/safeMarkdown.ts` and are set with `isTrusted`, `supportHtml`, and `supportThemeIcons` off (arch §8).
- In test mode, `TestApi.threads.snapshot(uri)` and `stepSnapshots(uri)` return each thread's line, label, context value, authors, comment label, body, and expanded state.

## CodeLens rows

`ui/codeLens.ts` provides:

- **Step title rows (S2, `StepCodeLens`):** on each anchored step's first line, "N · Title  Lstart–end" (prefixed with `$(arrow-right)` when focused), "‹ Previous", and "Next ›". Each runs the internal `logiclens.focusStep(uriString, index)`, which checks both arguments against the session. Lenses refresh on structural session changes only.
- **Trail breadcrumbs (S10):** above line 1 of the current file when the trail has more than one entry; one lens per crumb, middle crumbs collapsed into a `…` lens that opens a quick pick.
- **Explain (opt-in):** "Explain" above top-level and class-member symbols from the document symbol provider, only when `logiclens.codeLens.enabled`. Hidden for excluded files.

## Editor decorations

`ui/decorations.ts` owns these `TextEditorDecorationType`s:

- **focus:** `backgroundColor` from `editor.rangeHighlightBackground`, `isWholeLine`, left border via `borderWidth: 0 0 0 2px` with `focusBorder` color.
- **dim:** `opacity: 0.7` over all lines outside the focused ranges (only when `logiclens.focusDimming`).
- **gutter number:** one type per step number, created on first use: an SVG data URI of the number in an outlined box, light and dark variants. Shown on the focused step's first line only. (A heavier high-contrast stroke is not possible: decoration options have only light and dark variants.)

Two more gutter decoration types: **withheld** (S1; an SVG data URI with light and dark variants, since gutter icons cannot use codicons or theme colors) (lock icon, lines withheld by the secret scan, while the walkthrough is open) and **bookmark** (codicon `bookmark`, S11). Gutter icons do not stack; precedence is step number, then withheld, then bookmark, with the hover message listing all.

Decorations are reapplied on `onDidChangeVisibleTextEditors`, on every structural session change, when `logiclens.focusDimming` changes, and (S8) when ranges move. Focusing a step (`commands/steps.ts`) sets the selection to the start of its first line and calls `revealRange` from the step's thread line to its last line with `InCenterIfOutsideViewport`, then sets a 5-second status bar message announcing the step.

`ui/stepContext.ts` sets `logiclens.walkthroughActive` and `logiclens.stepFocused` for the active editor, marks a walkthrough stale on `onDidChangeTextDocument`, and runs follow mode: it listens to keyboard and mouse `onDidChangeTextEditorSelection` (debounced 100 ms) and, only while a step is focused and `logiclens.followCursor` is on, moves `focus` to the step under the cursor without changing `opened`, scrolling, or the selection.

In test mode, `TestApi.decorations.appliedTo(uri)` returns the focus ranges, number of dimmed ranges, gutter number, and lock lines last applied.

## Question threads (ADR-0008, S4)

- The same `CommentController` as the inline explanations; question threads use their own `contextValue`s.
- `commentingRangeProvider` returns the full document range for files that are trusted, not excluded, and of scheme `file` or `untitled`. This gives the gutter "+" on every line.
- New thread input: the user's text becomes a `Comment` with author "You"; LogicLens adds a reply comment with author "LogicLens · provider/model" whose `body` is a `MarkdownString` updated as chunks arrive (throttled to about 10 updates per second).
- Comment `contextValue` drives menus: copy, regenerate, delete; thread-level stop while streaming.
- `thread.range` is updated by the range tracker (arch §7). When the anchored line is deleted, thread `label` becomes "code changed" and `collapsibleState` collapsed.
- If another extension also provides commenting ranges (for example a pull request extension), VS Code shows a picker on "+"; this is expected and documented in the README.

## Status bar

Right-aligned item: codicon `sparkle` plus provider short name and model (S1: the label `LogicLens` only; busy shows a spinning `loading` icon, click runs `logiclens.stop`, and the `logiclens.busy` context key is set). While busy, the icon spins and the tooltip shows the request. Click runs `logiclens.selectProvider`. Background color is never changed except for an error state, which uses `statusBarItem.errorBackground`.

## Trail breadcrumbs (S10, ADR-0021)

`nav/trail.ts` owns the trail; `ui/codeLens.ts` renders it as CodeLens crumbs whose commands carry only the entry index. The trail service validates the index and does the navigation (open document, `revealRange`, set selection, set focused step). Context keys `logiclens.trailCanGoBack` and `logiclens.trailCanGoForward` are updated on every change.

## Bookmarks view (S11, ADR-0022)

`ui/bookmarksView.ts` is a `TreeDataProvider` over the bookmark store: file nodes, then bookmark nodes with `contextValue` driving Edit Note, Copy as Markdown, and Remove. Selecting a node runs an internal command that reveals the range, applies the focus decoration, and shows the saved explanation as a read-only inline thread at the range's first line.

## Quick picks

Provider picker shows each provider with its state as description and a codicon, grouped into Ready and Others, with "Set API key…" and "Install…" actions inline. Model picker is a second step.
