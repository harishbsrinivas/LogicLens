# 4. Provider Layer

## Interface

Described in prose; signatures are fixed in `src/providers/types.ts` during S1.

- **`Provider`**
  - `id` (matches `clarity.provider` enum), `label`, `kind` (`vscode-lm`, `cli`, `http`)
  - `detect()`: returns `ProviderState` (`ready`, `needs-sign-in`, `not-installed`, `unavailable` with reason) and the list of models if cheap to get. Must not send user code.
  - `listModels()`: model IDs and display names.
  - `stream(request, token)`: async iterable of chunks: `{ type: 'text', text }`, then a final `{ type: 'done', usage? }`, or throws a `ProviderError` with a category (`auth`, `quota`, `rate-limit`, `timeout`, `not-found`, `cancelled`, `bad-response`, `unknown`) and a user-facing message.
  - `termsUrl`, `dataLeavesMachine` (false only for local Ollama).
- **`ProviderRequest`**: `system` text, `messages` (user and assistant turns, text only), `model?`, `maxOutputTokens`.
- Adapters never see VS Code documents or ranges, only strings.

## Registry

- Holds all adapters, runs `detect()` in parallel with a 3-second timeout each, caches states for 60 seconds.
- Resolves `auto` to the first Ready adapter in spec §6 order.
- Emits change events for the status bar and setup view.

## Adapters

### `vscode-lm` (S1)

- `vscode.lm.selectChatModels()` (optionally filtered by vendor or family when the user picks one) lists models. Model display uses `model.name` and `model.vendor`.
- `model.sendRequest(messages, {}, token)`; iterate `response.text`.
- The system prompt is sent as the first user message, because the Language Model API has no system role in all versions (confirm in S0).
- First use triggers VS Code's consent dialog; a refusal surfaces as a `LanguageModelError` with a no-permissions code, mapped to `auth` with a message explaining how to allow access.
- Token counting via `model.countTokens` for context budgeting.
- Feature-detect `vscode.lm`; in editors without it the adapter reports `unavailable`.

### CLI adapters (S6, S7)

Shared helper `cli/spawn.ts`:

- `spawn(binary, fixedArgs, { shell: false, cwd: isolatedDir, env: minimalEnv })`.
- `isolatedDir` is an empty folder under the extension's global storage, so the CLI does not load project instruction files or index the repo, and has nothing to modify (ADR-0005).
- Prompt written to stdin, then stdin closed.
- stdout parsed line by line by the adapter (most CLIs offer a JSON-lines stream mode; text deltas are extracted from it). stderr collected, capped at 64 KB, used for error messages.
- Timeout from `clarity.cli.timeoutSeconds`; cancel kills the process tree.
- Output cap of 1 MB per request.
- `detect()` runs `<binary> --version` only.

Per adapter, to be verified in the S0 spike and recorded here:

| Adapter | Expected invocation shape (verify) | Restricting tools | Auth check |
|---|---|---|---|
| `claude-code` | **Verified (S0, v2.1.312, Linux):** `claude -p --output-format stream-json --verbose --include-partial-messages --no-session-persistence [--model <id or alias>]`; prompt on stdin. Text deltas are `stream_event` lines with `event.delta.type == "text_delta"`; final line is `type: "result"` | **Verified:** `--tools ""` (init line reports `tools: []`), `--strict-mcp-config` (no MCP servers), `--setting-sources ""` (no user or project settings or hooks). With tools off, a model that "calls" a tool only emits text; nothing runs | **Verified:** not signed in gives an `assistant` line with `error: "authentication_failed"`, a `result` line with `is_error: true` and text `Not logged in · Please run /login`, and exit code 1. Map `authentication_failed` to `auth` |
| `codex` | `codex exec` with JSON output, prompt on stdin, skip the git-repo check since cwd is isolated | `--sandbox read-only`, approvals never | Same |
| `gemini-cli` | `gemini` non-interactive prompt mode with streaming JSON output if available | No tool approval mode; isolated cwd | Same |
| `kiro` | Kiro CLI non-interactive chat mode, if one exists | Trust no tools | Same |

If a CLI cannot be run with tools disabled, its adapter is marked "agentic" in the provider picker and data notice, and is not offered by `auto` (ADR-0005).

### HTTP adapters (S7)

Shared helper `http/sse.ts` reads server-sent events from `fetch` (Node 20+ global fetch in the extension host).

- `anthropic`: Messages API, streaming. Key from `SecretStorage` key `clarity.anthropic.apiKey`. Base URL override from `clarity.anthropic.baseUrl` (machine scope). Model list from the Models API, with the user able to type an ID.
- `openai`: Responses or Chat Completions API, streaming (pick one in S7; both are widely supported by compatible gateways, Chat Completions more so). Key `clarity.openai.apiKey`.
- `ollama`: `/api/chat` streaming NDJSON; `/api/tags` for models and detection.
- Never log request bodies or headers outside debug mode; always redact keys.

## Adding a provider

1. Add the adapter under `providers/`, implement the interface, add unit tests with recorded fixture streams.
2. Add the enum value to `clarity.provider` in spec §9 and `package.json`.
3. Add a row to spec §6 and to the table above.
4. Add an ADR if the provider changes where code goes in a new way (for example a new cloud).

## S0 spike checklist

- [ ] `vscode.lm` in VS Code stable: list models with Copilot signed in; stream a reply; confirm consent behavior and error codes; confirm system-message support.
- [ ] `vscode.lm` in Cursor, Kiro, Windsurf, VSCodium: does it exist, does it return any models?
- [x] Claude Code CLI: flags, tools off, model choice, no sign-in behavior verified on Linux (table above). Windows path resolution still open.
- [ ] Codex CLI: same.
- [ ] Gemini CLI: same.
- [ ] Kiro CLI: does a non-interactive mode exist; flags; auth.
- [ ] Extension IDs of Claude Code, Codex, and Kiro extensions, for the setup view's "Install" links.
- [ ] Measure time to first token for each on a 300-line file. Claude Code, short prompt only: process start to `init` about 0.4 s, first text delta about 1.6 s later.

Record results in this file and resolve ADR-0016 and ADR-0017.

Not yet run on the S0 machine (no Copilot sign-in, no Codex, Gemini, or Kiro CLI, no forks installed): `vscode.lm`, Codex, Gemini, Kiro, fork checks, the protocol trial on three sample files, and the 300-line timing.
