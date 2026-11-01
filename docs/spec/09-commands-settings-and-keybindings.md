# 9. Commands, Settings, and Keybindings

Names here are the contract for `package.json`. Add new ones here first.

## Commands

| ID | Title | Where |
|---|---|---|
| `logiclens.explainFile` | LogicLens: Explain File | Palette, editor title, editor context, Explorer context |
| `logiclens.explainSelection` | LogicLens: Explain Selection | Palette, editor context (when selection) |
| `logiclens.explainSymbol` | LogicLens: Explain Symbol | CodeLens, palette (symbol picker) |
| `logiclens.askAtLine` | LogicLens: Ask About This Line | Palette, editor context, keybinding |
| `logiclens.nextStep` | LogicLens: Next Step | Palette, keybinding, step CodeLens |
| `logiclens.previousStep` | LogicLens: Previous Step | Palette, keybinding, step CodeLens |
| `logiclens.clearFocus` | LogicLens: Clear Step Highlight | Escape when a step is focused |
| `logiclens.refresh` | LogicLens: Refresh Explanation | Explanation thread title, palette |
| `logiclens.stop` | LogicLens: Stop | Explanation thread title and status bar while busy, palette |
| `logiclens.closeExplanation` | LogicLens: Close Explanation | Explanation thread title, palette |
| `logiclens.selectProvider` | LogicLens: Select AI Provider | Status bar, palette |
| `logiclens.selectModel` | LogicLens: Select Model | Palette, provider picker |
| `logiclens.setDepth` | LogicLens: Set Explanation Depth | Explanation thread title, palette |
| `logiclens.setAudience` | LogicLens: Set Audience | Explanation thread title, palette |
| `logiclens.setJargon` | LogicLens: Set Jargon Level | Explanation thread title, palette |
| `logiclens.followDefinition` | LogicLens: Follow to Definition | Palette, editor context, step menu, keybinding |
| `logiclens.trailBack` | LogicLens: Trail Back | Palette, trail CodeLens, keybinding |
| `logiclens.trailForward` | LogicLens: Trail Forward | Palette, trail CodeLens, keybinding |
| `logiclens.clearTrail` | LogicLens: Clear Trail | Palette, trail list |
| `logiclens.addBookmark` | LogicLens: Add Bookmark | Palette, editor context, step and comment menus, keybinding |
| `logiclens.editBookmarkNote` | LogicLens: Edit Bookmark Note | Bookmarks view |
| `logiclens.removeBookmark` | LogicLens: Remove Bookmark | Bookmarks view |
| `logiclens.clearAllBookmarks` | LogicLens: Clear All Bookmarks | Bookmarks view toolbar, palette |
| `logiclens.setPersonality` | LogicLens: Set Personality | Explanation thread title, palette (S12) |
| `logiclens.setApiKey` | LogicLens: Set API Key… | Palette, provider picker (S7) |
| `logiclens.clearThreadsInFile` | LogicLens: Clear Threads in File | Palette |
| `logiclens.clearAllThreads` | LogicLens: Clear All Threads | Palette |
| `logiclens.clearCache` | LogicLens: Clear Cache | Palette |
| `logiclens.resetDataNotices` | LogicLens: Reset Data Notices | Palette |
| `logiclens.showLog` | LogicLens: Show Log | Palette |
| `logiclens.viewTerms` | LogicLens: View Terms of Use | Palette, terms prompt |

## Default keybindings

Chosen to avoid common defaults; all use a `Ctrl+Alt+E` / `Cmd+Alt+E` chord prefix ("E" for explain).

| Command | Windows / Linux | macOS | When |
|---|---|---|---|
| `logiclens.explainFile` | `Ctrl+Alt+E F` | `Cmd+Alt+E F` | `editorTextFocus` |
| `logiclens.explainSelection` | `Ctrl+Alt+E S` | `Cmd+Alt+E S` | `editorHasSelection` |
| `logiclens.askAtLine` | `Ctrl+Alt+E Q` | `Cmd+Alt+E Q` | `editorTextFocus` |
| `logiclens.followDefinition` | `Ctrl+Alt+E G` | `Cmd+Alt+E G` | `editorTextFocus` |
| `logiclens.trailBack` | `Ctrl+Alt+E [` | `Cmd+Alt+E [` | `logiclens.trailCanGoBack` |
| `logiclens.trailForward` | `Ctrl+Alt+E ]` | `Cmd+Alt+E ]` | `logiclens.trailCanGoForward` |
| `logiclens.addBookmark` | `Ctrl+Alt+E M` | `Cmd+Alt+E M` | `editorTextFocus` |
| `logiclens.nextStep` | `Alt+]` | `Alt+]` | `logiclens.walkthroughActive` |
| `logiclens.previousStep` | `Alt+[` | `Alt+[` | `logiclens.walkthroughActive` |
| `logiclens.clearFocus` | `Escape` | `Escape` | `logiclens.stepFocused && editorTextFocus && !suggestWidgetVisible` |

Final keys are confirmed in S9 against VS Code defaults and popular keymaps. The MVP is Linux only (ADR-0026); the macOS column is kept for S13 and not verified before then.

## Settings

Scope column: `res` = resource (workspace allowed), `mach` = machine, `app` = application. Settings that change where code goes or what runs are never `res`.

| Setting | Type, default | Scope | Purpose |
|---|---|---|---|
| `logiclens.provider` | enum, `auto` | app | `auto`, `vscode-lm`, `claude-code`. S7 adds `codex`, `gemini-cli`, `kiro`, `anthropic`, `openai`, `ollama` |
| `logiclens.model` | string, `""` | app | Model ID for the chosen provider; empty means the provider's default |
| `logiclens.depth` | enum, `standard` | res | `overview`, `standard`, `detailed` |
| `logiclens.audience` | enum, `practitioner` | res | `eli5`, `newcomer`, `practitioner`, `expert` (spec §4) |
| `logiclens.jargon` | enum, `auto` | res | `auto`, `avoid`, `define`, `use` (spec §4) |
| `logiclens.personality` | enum, `none` | app | `none`, `patient-teacher`, `skater`, `sarcastic`, `noir-detective`, `sports-commentator` (spec §15, S12) |
| `logiclens.secrets.action` | enum, `skip-lines` | app | `skip-lines`, `refuse-file` (spec §8); no off value |
| `logiclens.explanationLanguage` | string, `auto` | app | BCP 47 tag or `auto` |
| `logiclens.exclude` | string[], secret patterns | res | Globs never read or sent (may only add, see note) |
| `logiclens.maxLines` | number, 2000 | res | Above this, offer partial explanation |
| `logiclens.focusDimming` | boolean, true | app | Dim lines outside the focused step |
| `logiclens.followCursor` | boolean, true | app | Highlight the step containing the cursor |
| `logiclens.codeLens.enabled` | boolean, false | app | Show "Explain" CodeLens on symbols |
| `logiclens.cache.enabled` | boolean, true | app | Persist walkthroughs and threads locally |
| `logiclens.cli.claudePath` | string, `""` | mach | Path to `claude`; empty means `PATH` |
| `logiclens.cli.codexPath` | string, `""` | mach | Path to `codex` (S7) |
| `logiclens.cli.geminiPath` | string, `""` | mach | Path to `gemini` (S7) |
| `logiclens.cli.kiroPath` | string, `""` | mach | Path to the Kiro CLI (S7) |
| `logiclens.cli.timeoutSeconds` | number, 180 | app | Kill CLI requests after this |
| `logiclens.ollama.url` | string, `http://localhost:11434` | mach | Ollama base URL (S7) |
| `logiclens.anthropic.baseUrl` | string, `""` | mach | Optional override (for proxies) (S7) |
| `logiclens.openai.baseUrl` | string, `""` | mach | Optional override (for compatible gateways) (S7) |
| `logiclens.debug.logPrompts` | boolean, false | app | Log prompts and responses to the output channel |

Note on `logiclens.exclude`: workspace values are merged with user values, never replace them, so a repository cannot remove a user's exclusions.

## Context keys

`logiclens.walkthroughActive`, `logiclens.stepFocused`, `logiclens.busy`, `logiclens.providerReady`, `logiclens.fileExcluded`, `logiclens.trailCanGoBack`, `logiclens.trailCanGoForward`, `logiclens.hasBookmarks`.

## Views

There is no LogicLens panel; explanations render inline in the editor (ADR-0028). The only view is the Bookmarks tree (S11).

| ID | Name | Container |
|---|---|---|
| `logiclens.bookmarks` | Bookmarks (tree) | LogicLens |
