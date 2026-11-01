# 9. Commands, Settings, and Keybindings

Names here are the contract for `package.json`. Add new ones here first.

## Commands

| ID | Title | Where |
|---|---|---|
| `clarity.explainFile` | Clarity: Explain File | Palette, editor title, editor context, Explorer context |
| `clarity.explainSelection` | Clarity: Explain Selection | Palette, editor context (when selection) |
| `clarity.explainSymbol` | Clarity: Explain Symbol | CodeLens, palette (symbol picker) |
| `clarity.askAtLine` | Clarity: Ask About This Line | Palette, editor context, keybinding |
| `clarity.nextStep` | Clarity: Next Step | Palette, keybinding, panel |
| `clarity.previousStep` | Clarity: Previous Step | Palette, keybinding, panel |
| `clarity.clearFocus` | Clarity: Clear Step Highlight | Escape when a step is focused |
| `clarity.refresh` | Clarity: Refresh Explanation | Panel, palette |
| `clarity.stop` | Clarity: Stop | Panel, status bar while busy |
| `clarity.selectProvider` | Clarity: Select AI Provider | Status bar, palette |
| `clarity.selectModel` | Clarity: Select Model | Palette, provider picker |
| `clarity.setDepth` | Clarity: Set Explanation Depth | Panel, palette |
| `clarity.setAudience` | Clarity: Set Audience | Panel, palette |
| `clarity.setApiKey` | Clarity: Set API Key… | Palette, setup view |
| `clarity.clearThreadsInFile` | Clarity: Clear Threads in File | Palette |
| `clarity.clearAllThreads` | Clarity: Clear All Threads | Palette |
| `clarity.clearCache` | Clarity: Clear Cache | Palette |
| `clarity.resetDataNotices` | Clarity: Reset Data Notices | Palette |
| `clarity.showLog` | Clarity: Show Log | Palette |

Temporary: `clarity.hello` (Clarity: Hello, palette) exists only as the S0 skeleton smoke test and is removed when S1 adds `clarity.explainFile`.

## Default keybindings

Chosen to avoid common defaults; all use a `Ctrl+Alt+E` / `Cmd+Alt+E` chord prefix ("E" for explain).

| Command | Windows / Linux | macOS | When |
|---|---|---|---|
| `clarity.explainFile` | `Ctrl+Alt+E F` | `Cmd+Alt+E F` | `editorTextFocus` |
| `clarity.explainSelection` | `Ctrl+Alt+E S` | `Cmd+Alt+E S` | `editorHasSelection` |
| `clarity.askAtLine` | `Ctrl+Alt+E Q` | `Cmd+Alt+E Q` | `editorTextFocus` |
| `clarity.nextStep` | `Alt+]` | `Alt+]` | `clarity.walkthroughActive` |
| `clarity.previousStep` | `Alt+[` | `Alt+[` | `clarity.walkthroughActive` |
| `clarity.clearFocus` | `Escape` | `Escape` | `clarity.stepFocused && editorTextFocus && !suggestWidgetVisible` |

Final keys are confirmed in S9 against VS Code defaults and popular keymaps.

## Settings

Scope column: `res` = resource (workspace allowed), `mach` = machine, `app` = application. Settings that change where code goes or what runs are never `res`.

| Setting | Type, default | Scope | Purpose |
|---|---|---|---|
| `clarity.provider` | enum, `auto` | app | `auto`, `vscode-lm`, `claude-code`, `codex`, `gemini-cli`, `kiro`, `anthropic`, `openai`, `ollama` |
| `clarity.model` | string, `""` | app | Model ID for the chosen provider; empty means the provider's default |
| `clarity.depth` | enum, `standard` | res | `overview`, `standard`, `detailed` |
| `clarity.audience` | enum, `practitioner` | res | `newcomer`, `practitioner`, `expert` |
| `clarity.explanationLanguage` | string, `auto` | app | BCP 47 tag or `auto` |
| `clarity.exclude` | string[], secret patterns | res | Globs never read or sent (may only add, see note) |
| `clarity.maxLines` | number, 2000 | res | Above this, offer partial explanation |
| `clarity.focusDimming` | boolean, true | app | Dim lines outside the focused step |
| `clarity.followCursor` | boolean, true | app | Highlight the step containing the cursor |
| `clarity.codeLens.enabled` | boolean, false | app | Show "Explain" CodeLens on symbols |
| `clarity.cache.enabled` | boolean, true | app | Persist walkthroughs and threads locally |
| `clarity.cli.claudePath` | string, `""` | mach | Path to `claude`; empty means `PATH` |
| `clarity.cli.codexPath` | string, `""` | mach | Path to `codex` |
| `clarity.cli.geminiPath` | string, `""` | mach | Path to `gemini` |
| `clarity.cli.kiroPath` | string, `""` | mach | Path to the Kiro CLI |
| `clarity.cli.timeoutSeconds` | number, 180 | app | Kill CLI requests after this |
| `clarity.ollama.url` | string, `http://localhost:11434` | mach | Ollama base URL |
| `clarity.anthropic.baseUrl` | string, `""` | mach | Optional override (for proxies) |
| `clarity.openai.baseUrl` | string, `""` | mach | Optional override (for compatible gateways) |
| `clarity.debug.logPrompts` | boolean, false | app | Log prompts and responses to the output channel |

Note on `clarity.exclude`: workspace values are merged with user values, never replace them, so a repository cannot remove a user's exclusions.

## Context keys

`clarity.walkthroughActive`, `clarity.stepFocused`, `clarity.busy`, `clarity.providerReady`, `clarity.fileExcluded`.
