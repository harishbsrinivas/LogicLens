# 13. Following Code Across Files

Real code calls into other files. A reader who jumps to a definition, then another, soon forgets where they started and why. LogicLens keeps a **trail** of those jumps so the user can follow the code and always find the way back.

## Following a symbol

- **LogicLens: Follow to Definition** (editor context menu, palette, `Ctrl+Alt+E G`) with the cursor on an identifier looks up its definition with VS Code's definition provider (`vscode.executeDefinitionProvider`), opens it, and adds a trail entry.
- Several definitions: a quick pick lists them (file, line, preview); the chosen one is followed.
- No definition found: the status bar says so; the trail is unchanged.
- The same action is offered on a focused walkthrough step for identifiers inside its range ("Follow…" in the step menu lists the symbols the step's lines reference).
- Plain VS Code **Go to Definition** (F12, Ctrl+click) is not recorded. LogicLens cannot reliably tell a definition jump from any other editor switch, and a trail that sometimes records jumps would be worse than one that records them on request.

Following never sends code. Definition lookup is done by the language's own extension on the machine. When the user lands in a file with no walkthrough, a CodeLens above the symbol offers **Explain <symbol>** (a symbol target, spec §3). Explaining is a separate explicit action (spec §8).

## The trail

A trail entry records: file, symbol name (if known), cursor position, the walkthrough step focused at the moment the user left, and the scroll position. Entries hold no code text.

- The trail is linear, like browser history. Going back and then following something new drops the forward entries.
- Up to 30 entries; the oldest is dropped beyond that.
- One trail per window. It is kept in workspace state so it survives a window reload, and is cleared by **LogicLens: Clear Trail**.

## Breadcrumbs

When the trail has more than one entry, a row of CodeLens breadcrumbs above the first line of the current file shows it:

```
app.ts › handleRequest  ›  auth.ts › verifyUser  ›  token.ts › decode
```

- Each crumb is file plus symbol; the current one is marked with a dot. Hover shows the full path and line.
- Clicking a crumb reopens that file at the saved position, restores its walkthrough (in session or from cache, spec §10), and refocuses the step that was focused when the user left.
- When there are more than four crumbs, the middle ones collapse into a `…` crumb that opens the trail in a quick pick.
- Excluded files (spec §8) appear in the trail with a lock icon; their crumb opens the file, and no explanation is offered for it.
- If a crumb's file was deleted or its position no longer exists, the crumb is marked "(missing)"; clicking it offers to remove it.

## Back and forward

- **LogicLens: Trail Back** (`Ctrl+Alt+E [`) and **LogicLens: Trail Forward** (`Ctrl+Alt+E ]`) move along the trail with the same restore behavior as clicking a crumb.
- These are separate from VS Code's own Go Back / Go Forward, which keep working as before.

## Accessibility

The breadcrumb bar is a `navigation` landmark with an ordered list; the current entry has `aria-current="location"`. Moving along the trail announces "Back to auth.ts, verifyUser, step 3".
