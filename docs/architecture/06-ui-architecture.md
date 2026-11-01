# 6. UI Architecture

## Panel (webview view)

- Contributed as a `webviewView` in a LogicLens view container. Default location is the secondary side bar where supported; falls back to the activity bar container. Users can move it.
- `retainContextWhenHidden: false`. The webview is a pure function of state: on show, the host posts the full state for the active document; afterwards it posts incremental updates.
- Built with Svelte 5 and Vite into one JS and one CSS file under `dist/webview/` (ADR-0009). No runtime dependencies besides a Markdown renderer with HTML disabled and a sanitizer.
- Styling uses only `--vscode-*` CSS variables and codicons (bundled font, loaded from `localResourceRoots`).

### Message bridge

Types in `shared/messages.ts`. Every message has a `type` and a `sessionId`.

Host to webview: `state` (full snapshot), `overviewDelta`, `stepStart`, `stepDelta`, `stepConcepts`, `summaryDelta`, `status` (busy, error, done with usage), `focus` (step index), `providers` (list and states), `settings` (depth, audience, jargon, personality), `withheld` (line numbers only, never text), `trail` (entries and current index), `bookmarkState` (bookmarked step indexes), `showBookmark` (saved explanation card).

Webview to host: `ready`, `explain`, `focusStep`, `askStep`, `askConcept`, `refresh`, `refreshChanged`, `stop`, `setDepth`, `setAudience`, `setJargon`, `setPersonality`, `pickProvider`, `openLink`, `copy`, `feedback`, `trailNavigate`, `followFromStep`, `bookmarkStep`, `explainAgain`.

The host validates every incoming message: known type, current `sessionId`, step index in range, trail index in range, bookmark ID known, link scheme allowed. Unknown or stale messages are dropped and logged at debug level.

Deltas are batched on the host at about 30 ms intervals to keep the webview smooth.

## Editor decorations

`ui/decorations.ts` owns three `TextEditorDecorationType`s, created once:

- **focus:** `backgroundColor` from `editor.rangeHighlightBackground`, `isWholeLine`, left border via `borderWidth: 0 0 0 2px` with `focusBorder` color.
- **dim:** `opacity: 0.7` over all lines outside the focused ranges (only when `logiclens.focusDimming`).
- **gutter number:** per-step SVG icons generated at runtime as data URIs, using a theme-neutral rendering (outlined digit). High-contrast themes get a heavier stroke.

Two more gutter decoration types: **withheld** (codicon `lock`, lines withheld by the secret scan, while the walkthrough is open) and **bookmark** (codicon `bookmark`, S11). Gutter icons do not stack; precedence is step number, then withheld, then bookmark, with the hover message listing all.

Decorations are reapplied on `onDidChangeVisibleTextEditors` and when ranges move (arch §7). Scrolling uses `revealRange(range, InCenterIfOutsideViewport)`.

Follow mode listens to `onDidChangeTextEditorSelection` (debounced 100 ms) and posts `focus` to the webview without moving the editor.

## Comment threads (ADR-0008)

- One `CommentController` with id `logiclens`, label "LogicLens".
- `commentingRangeProvider` returns the full document range for files that are trusted, not excluded, and of scheme `file` or `untitled`. This gives the gutter "+" on every line.
- New thread input: the user's text becomes a `Comment` with author "You"; LogicLens adds a reply comment with author "LogicLens · provider/model" whose `body` is a `MarkdownString` updated as chunks arrive (throttled to about 10 updates per second).
- Comment `contextValue` drives menus: copy, regenerate, delete; thread-level stop while streaming.
- `thread.range` is updated by the range tracker (arch §7). When the anchored line is deleted, thread `label` becomes "code changed" and `collapsibleState` collapsed.
- If another extension also provides commenting ranges (for example a pull request extension), VS Code shows a picker on "+"; this is expected and documented in the README.

## Status bar

Right-aligned item: codicon `sparkle` plus provider short name and model. While busy, the icon spins and the tooltip shows the request. Click runs `logiclens.selectProvider`. Background color is never changed except for an error state, which uses `statusBarItem.errorBackground`.

## CodeLens

`ui/codeLens.ts` provides "Explain" above top-level and class-member symbols from the document symbol provider, only when enabled. Hidden for excluded files.

## Trail breadcrumbs (S10, ADR-0021)

`nav/trail.ts` owns the trail; the panel renders it from `trail` messages and sends `trailNavigate(index)`. The host does the navigation (open document, `revealRange`, set selection, set focused step) so the webview never handles URIs it could forge. Context keys `logiclens.trailCanGoBack` and `logiclens.trailCanGoForward` are updated on every change.

## Bookmarks view (S11, ADR-0022)

`ui/bookmarksView.ts` is a `TreeDataProvider` over the bookmark store: file nodes, then bookmark nodes with `contextValue` driving Edit Note, Copy as Markdown, and Remove. Selecting a node runs an internal command that reveals the range, applies the focus decoration, and posts `showBookmark` to the panel.

## Quick picks

Provider picker shows each provider with its state as description and a codicon, grouped into Ready and Others, with "Set API key…" and "Install…" actions inline. Model picker is a second step.
