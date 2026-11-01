# 3. Entry Points and Targets

## Targets

A **target** is the code being explained. The MVP supports:

| Target | Defined by | Context also sent |
|---|---|---|
| File | The whole document | Nothing else by default; see "Context" in spec §8 |
| Selection | The selected range, extended to whole lines | The enclosing file, truncated around the selection if large |
| Symbol | A function, method, or class from the document symbol provider | The enclosing file, truncated around the symbol if large |
| Line | A single line (for questions) | The enclosing symbol, or ±40 lines if no symbol, plus the active walkthrough step if any |

Any text document VS Code can open is a valid target, including unsaved and untitled documents. Binary files, notebooks, and files over the size limit are not (see Limits).

## Entry points

### From the editor
- **Editor title bar button** (LogicLens icon): explains the file, or the selection if the active editor has one. **Explain again** keeps the walkthrough's selection or symbol.
- **Editor context menu:** "Explain File", "Explain Selection" (when a selection exists), "Ask About This Line".
- **Command palette:** every command in spec §9.
- **Keybindings:** defaults in spec §9.
- **CodeLens** above functions and classes: "Explain". Off by default; enabled by `logiclens.codeLens.enabled`. Uses the language's document symbol provider, so it works for any language with one.
- **Gutter "+"** on hover: opens a question thread at that line (Comments API, spec §5).

### From the Explorer
- **Explorer context menu** on a file: "LogicLens: Explain File". Opens the file in an editor (preview tab) and starts the walkthrough.
- Multi-select or folders: the menu item is hidden in the MVP. Folder overviews are a post-MVP candidate (spec §11).

### From an explanation in the editor
- **Explain again** and **Refresh** in the title of the file's explanation thread (stale, stopped, or failed walkthroughs included).
- **Ask** on any step thread (spec §5, J4).

## Explanations stay with their document

- Explanations render inline in the editor of the document they explain (spec §7, ADR-0028). Each document has at most one walkthrough at a time.
- Switching editor tabs shows that document's walkthrough, if it has one. It never starts a request on its own.
- Starting a new explanation while one is streaming for the same document cancels the old one after confirmation.

## Limits

- Files over `logiclens.maxLines` (default 2,000) or 200 KB are not sent whole. LogicLens offers to explain the selection (if any), the visible range, or a chosen symbol instead.
- A selection or symbol is sent with as much of the surrounding file as fits the context budget (arch §5.3); the walkthrough covers only the target lines, and its overview sits just above them.
- Minified or generated files (one line over 1,000 characters, or a header such as `@generated`) get a warning before sending.
- Notebooks (`.ipynb`) are out of scope for the MVP; the commands are disabled for notebook cells.
