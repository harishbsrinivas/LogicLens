# 6. UI Architecture

There is no webview. Explanations render inline in the editor with stable APIs only (ADR-0028, superseding ADR-0009).

## Inline explanation threads

`ui/inlineThreads.ts` owns the one `CommentController` (id `logiclens`, label "LogicLens"). It listens to the session store and renders each document's walkthrough as read-only threads (`canReply = false`).

- **S8:** overview `contextValue` `stale` (Refresh) or `stale-steps` (Refresh and Refresh Changed Steps) once the document is edited or a restored walkthrough has changed steps; Show All, Close, Regenerate with…, and Adjust Explanation stay available. Changed steps' labels end with "(code changed)". A restored walkthrough's header label is "Generated <age>" instead of the duration.
- **S3:** a selection or symbol walkthrough puts its overview thread at `stepLine(target.start)`, just above the target, and its label names the lines ("file.ts L5–8"). Title actions also include **Adjust Explanation…** (`logiclens.adjustExplanation`, finished or continuable), a quick pick for depth, audience, jargon, or all settings, so the title does not carry three more icons.
- **S1:** one thread per document, anchored at line 1 (`Range(0,0,0,0)`), created expanded; visible editors of that document scroll to the top when it is created. Its single comment has author `LogicLens · <provider> · <model>`, `label` with the duration once finished, and a `MarkdownString` body: the withheld-lines notice (line numbers only), the explanation text, and a stopped or failed note.
- **S2:** the overview thread holds the overview (or the Markdown fallback with its notice), unanchored steps marked "not linked to lines", and a stopped, incomplete, or failed note; the summary and things to watch are a second comment with author "Summary". Each anchored step gets its own thread attached to `stepLine(start) = max(0, start − 2)` (0-based), the line before the step, so it shows just above its code (ADR-0029). Step threads are created `Collapsed`; a thread is `Expanded` when it is the session's `opened` step or `showAll` is on. Expansion is set only when that wanted state changes, so a thread the user opened or closed by hand stays that way. A Markdown fallback has no step threads.
- Step thread: `label` "N · Title", one comment with author "LogicLens", `label` with its ranges ("L5–8"), body with the explanation and concept tags as inline code.
- Overview `thread.label`: "Explaining <file>…" while streaming, the file name when done, "<file>: stopped", "<file>: incomplete" (truncated), or "<file>: failed"; " (file changed since)" is appended once the document is edited.
- `thread.contextValue` drives `comments/commentThread/title` menus: overview `streaming` (Stop), `finished` (Explain again), `continuable` (Continue and Explain again); Show All Steps and Close on any overview thread; step threads are `step` with Ask About This Step (S4).
- Concept tags in a step body are links to `logiclens.askConcept` with arguments `[documentKey, stepIndex, conceptIndex]` only; the concept text comes from the session, never from the link. Step and overview comments set `isTrusted: { enabledCommands: ['logiclens.askConcept'] }` (arch §8). Thread commands receive the thread and resolve its document from `thread.uri` among the visible editors.
- Streaming text arrives through `SessionStore.onDelta`; bodies are re-rendered at most about every 100 ms. Structural changes (new step, status, focus) re-render at once. Each thread keeps a signature of its label, context value, and comments and is left alone when nothing changed.
- A new walkthrough for the same document disposes the old thread; closing the document or **Close Explanation** deletes the session entry, which disposes its thread.
- Bodies pass through `ui/safeMarkdown.ts` and are set with `isTrusted`, `supportHtml`, and `supportThemeIcons` off (arch §8).
- In test mode, `TestApi.threads.snapshot(uri)` and `stepSnapshots(uri)` return each thread's line, label, context value, authors, comment label, body, and expanded state.

## CodeLens rows

`ui/codeLens.ts` provides:

- **Step title rows (S2, `StepCodeLens`):** on each anchored step's first line, "N · Title  Lstart–end" (prefixed with `$(arrow-right)` when focused), "‹ Previous", and "Next ›". Each runs the internal `logiclens.focusStep(uriString, index)`, which checks both arguments against the session. Lenses refresh on structural session changes only.
- **Trail breadcrumbs (S10):** above line 1 of the current file when the trail has more than one entry; one lens per crumb, middle crumbs collapsed into a `…` lens that opens a quick pick.
- **Explain (opt-in, S3, `ExplainCodeLens`):** "Explain" above top-level and class-member functions, methods, classes, interfaces, enums, structs, modules, and namespaces from the document symbol provider, only when `logiclens.codeLens.enabled`. Hidden for excluded files. The provider is always registered and returns nothing while the setting is off; it refreshes when the setting or `logiclens.exclude` changes. The lens passes `[documentKey, line]`; `logiclens.explainSymbol` looks the symbol up again.

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

- `extension.ts` creates the one `CommentController` and passes it to `InlineThreads` and `ui/questionThreads.ts` (`QuestionThreads`); question threads use their own `contextValue`s.
- `commentingRangeProvider` (`commentingRanges`) returns the full document range for files that are trusted, not excluded, and of scheme `file` or `untitled`. This gives the gutter "+" on every line once LogicLens has activated (ADR-0030).
- `logiclens.askAtLine`, `askStep`, and `askConcept` open an empty thread (`canReply`, expanded, `contextValue` `question-new`) and remember its target range; a gutter "+" thread is created by VS Code. The input box's submit button runs `logiclens.submitQuestion` (`comments/commentThread/context`) with a `CommentReply`; the first submit adopts the thread into `QuestionStore`.
- Each turn renders as two comments: the question with author "You", and the answer with author "LogicLens · provider/model" whose `MarkdownString` body is re-rendered at most every 100 ms while streaming. Comments are `QuestionComment` objects carrying `threadId`, `turnId`, and `part`; VS Code passes the same object to comment menu commands.
- Comment `contextValue` drives `comments/comment/title`: `answer` has Copy, Regenerate, and Delete; `question` has Delete; `answer-busy` has none. Thread `contextValue` is `question-busy` (Stop in the title) while a turn is in flight, else `question`.
- Answers set `isTrusted: { enabledCommands: ['logiclens.revealLine'] }` for the line links; HTML and theme icons stay off (arch §8).
- `QuestionThreads` listens to `onDidChangeTextDocument` and moves each thread's range through the edits with `state/rangeShift.ts` (bottom-up). When every anchored line is deleted the thread label becomes "Code changed" and it collapses once. S8 replaces this with the shared range tracker.
- In test mode, `TestApi.questions` exposes `snapshots(uri)`, `comments(threadId)`, and `pendingThreads(uri)`.
- If another extension also provides commenting ranges (for example a pull request extension), VS Code shows a picker on "+"; this is expected and documented in the README.

## Status bar

`ui/statusBar.ts`, right-aligned: codicon `sparkle` plus the resolved model's label (for `vscode-lm`, "copilot · Auto"); the tooltip names the provider. It re-resolves through the registry (detection only) on activation and on every registry change, and sets `logiclens.providerReady`. No provider ready: `$(warning) LogicLens` on `statusBarItem.errorBackground`, tooltip with the reason. Click runs `logiclens.selectProvider`. While a walkthrough or question is in flight the icon spins, `logiclens.busy` is set, and click runs `logiclens.stop`. Background color is never changed except for the error state.

## Trail breadcrumbs (S10, ADR-0021)

`nav/trail.ts` is the pure trail model (follow, update, goTo, remove, serialize, restore, cap 30) plus `identifiersIn` for the step **Follow…** list. `nav/follow.ts` (`FollowService`) runs `vscode.executeDefinitionProvider` (Locations and LocationLinks), asks with a quick pick when there are several, opens the result, and records both ends; it persists the trail in `workspaceState` (`trail`) and sets `logiclens.trailCanGoBack` and `logiclens.trailCanGoForward`. Going to an entry first saves the current entry's cursor, scroll, and focused step, then opens the file (offering to remove a missing one), restores selection and scroll (`revealRange` at top), restores the walkthrough from the cache if needed (S8), and refocuses the saved step.

`ui/trailLens.ts` (`TrailCodeLens`) renders the crumbs above line 1 of the file the trail is currently on, when the trail has more than one entry: `file › symbol`, "● " on the current one, `$(lock)` for excluded files, "(missing)" for files that no longer exist, and `…` lenses for hidden ranges (`logiclens.trailPick`). Crumb commands carry only the entry index (`logiclens.trailGo`), which the service checks. When that file has no walkthrough, it also offers **Explain <symbol>** above the innermost symbol around the followed position (`logiclens.explainSymbol`, S3). `nav/` never imports `providers/` or `guard/`.

## Bookmarks view (S11, ADR-0022)

`ui/bookmarksView.ts` (S11):

- `BookmarksTree`, a `TreeDataProvider` for `logiclens.bookmarks` in the `logiclens` activity bar container (`media/logiclens.svg`): file nodes (resource URIs, so they get file icons), then bookmark nodes sorted by line, labelled with the note or title, described with ranges and "code changed", with a kind codicon (or `warning` when changed). `contextValue` `bookmark` drives inline Edit Note, Copy as Markdown, and Remove; the view title has Clear All Bookmarks (`logiclens.hasBookmarks`) and collapse all; `viewsWelcome` gives the empty state.
- Selecting a node runs `logiclens.showBookmark(id)`: opens the file, moves the cursor and reveals the range, highlights it (`BookmarkDecorations`, same style as a focused step), and shows `BookmarkThreads`' read-only thread at the range's first line: label "Bookmarked explanation" ("(code changed)" when lost), `contextValue` `bookmark` (Explain Again, Close), one comment with the provider and model, the date, the note, the question for answers, and the saved Markdown rendered with the same untrusted settings as live output.
- `BookmarkDecorations` puts an SVG bookmark gutter icon (light and dark variants) on each bookmark's first line, skipping lines whose gutter already shows the step number or a lock.
- `StepCodeLens` adds "$(bookmark) Bookmark" (`logiclens.bookmarkStep(key, index)`) or "$(bookmark) Bookmarked" (`logiclens.showBookmark(id)`) to each step row. Codicons have no filled bookmark, so the word changes instead of the icon.

## Quick picks

`ui/providerPicker.ts` (pure) builds the entries; `commands/provider.ts` shows them. Provider picker: **Auto** (naming the provider it would use), then a **Ready** group (model count), then **Not ready** (state as description, reason and setup action as detail; picking it runs the setup action instead of selecting). Model picker is a second step with **Default** first. Choices are saved to user settings. **Regenerate with…** is one flat list of every Ready provider's models. S7 adds "Set API key…".
