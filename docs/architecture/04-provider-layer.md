# 4. Provider Layer

## Interface

Signatures are in `src/providers/types.ts` (fixed in S1).

- **`Provider`**
  - `id` (matches `logiclens.provider` enum), `label`, `kind` (`vscode-lm`, `cli`, `http`)
  - `detect()`: returns `ProviderState` (`ready` with the model list, or `needs-sign-in`, `not-installed`, `unavailable` with a reason). Must not send user code. There is no separate model-list call; the gate uses the first model until the picker lands in S5.
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

- `vscode.lm.selectChatModels()` (bound in `vscodeLmApi.ts`, injected into `vscodeLm.ts` so the adapter is unit tested with a fake; optionally filtered by vendor or family when the user picks one) lists models. Model display uses `model.name` and `model.vendor`.
- **Default model (S0 finding):** VS Code 1.142 with Copilot Free lists `copilotcli · Auto` (agent-backed, `maxInputTokens` 0) first, then `copilot · GPT-4o mini` (12k input) and `copilot · Auto` (backed by claude-fable-5.1, about 936k input). `rankModels` orders vendor `copilot` first, then by `maxInputTokens`, so the default is `copilot · Auto`. Nothing is filtered (ADR-0025). Model IDs repeat across vendors (`auto`), so model keys are `vendor/id`.
- `model.sendRequest(messages, { justification }, token)`; iterate `response.text`. The justification text appears in VS Code's access prompt.
- The system prompt is sent as the first user message, because the Language Model API has no system role in all versions. Verified in S0: Copilot follows instructions given this way.
- First use may trigger VS Code's consent dialog; a refusal surfaces as a `LanguageModelError` with a no-permissions code, mapped to `auth` with a message explaining how to allow access. In the S0 spike (VS Code 1.142, Extension Development Host) no prompt appeared.
- Token counting via `model.countTokens` for context budgeting (works with Copilot: 4,043 tokens for a 300-line file; not used yet, S1 relies on the size limit).
- Feature-detect `vscode.lm`; in editors without it the adapter reports `unavailable`.

### CLI adapters (S6: `claude-code`; S7 after release: the rest)

Shared helper `cli/spawn.ts`:

- `spawn(binary, fixedArgs, { shell: false, cwd: isolatedDir, env: minimalEnv })`.
- `isolatedDir` is an empty folder under the extension's global storage, so the CLI does not load project instruction files or index the repo, and has nothing to modify (ADR-0005).
- Prompt written to stdin, then stdin closed.
- stdout parsed line by line by the adapter (most CLIs offer a JSON-lines stream mode; text deltas are extracted from it). stderr collected, capped at 64 KB, used for error messages.
- Timeout from `logiclens.cli.timeoutSeconds`; cancel kills the process tree.
- Output cap of 1 MB per request.
- `detect()` runs `<binary> --version` only.

Per adapter. `claude-code` is verified in S0; the others are verified in S7, after release (ADR-0025):

| Adapter | Expected invocation shape (verify) | Restricting tools | Auth check |
|---|---|---|---|
| `claude-code` | **Verified (S0, v2.1.312, Linux):** `claude -p --output-format stream-json --verbose --include-partial-messages --no-session-persistence [--model <id or alias>]`; prompt on stdin. Text deltas are `stream_event` lines with `event.delta.type == "text_delta"`; final line is `type: "result"` | **Verified:** `--tools ""` (init line reports `tools: []`), `--strict-mcp-config` (no MCP servers), `--setting-sources ""` (no user or project settings or hooks). With tools off, a model that "calls" a tool only emits text; nothing runs | **Verified:** not signed in gives an `assistant` line with `error: "authentication_failed"`, a `result` line with `is_error: true` and text `Not logged in · Please run /login`, and exit code 1. Map `authentication_failed` to `auth` |
| `codex` (S7) | `codex exec` with JSON output, prompt on stdin, skip the git-repo check since cwd is isolated | `--sandbox read-only`, approvals never | Same |
| `gemini-cli` (S7) | `gemini` non-interactive prompt mode with streaming JSON output if available | No tool approval mode; isolated cwd | Same |
| `kiro` (S7) | Kiro CLI non-interactive chat mode, if one exists | Trust no tools | Same |

If a CLI cannot be run with tools disabled, its adapter is marked "agentic" in the provider picker and data notice, and is not offered by `auto` (ADR-0005).

### HTTP adapters (S7, after release)

Shared helper `http/sse.ts` reads server-sent events from `fetch` (Node 20+ global fetch in the extension host).

- `anthropic`: Messages API, streaming. Key from `SecretStorage` key `logiclens.anthropic.apiKey`. Base URL override from `logiclens.anthropic.baseUrl` (machine scope). Model list from the Models API, with the user able to type an ID.
- `openai`: Responses or Chat Completions API, streaming (pick one in S7; both are widely supported by compatible gateways, Chat Completions more so). Key `logiclens.openai.apiKey`.
- `ollama`: `/api/chat` streaming NDJSON; `/api/tags` for models and detection.
- Never log request bodies or headers outside debug mode; always redact keys.

## Adding a provider

1. Add the adapter under `providers/`, implement the interface, add unit tests with recorded fixture streams.
2. Add the enum value to `logiclens.provider` in spec §9 and `package.json`.
3. Add a row to spec §6 and to the table above.
4. Add an ADR if the provider changes where code goes in a new way (for example a new cloud).

## S0 spike checklist (MVP providers, ADR-0025)

- [x] `vscode.lm` in VS Code stable (1.142, Linux) with **Copilot Free**: models listed (above); the real adapter streams a reply and maps Stop to `cancelled`; no consent prompt appeared in the Extension Development Host; the system prompt as a first user message works. The quota-exhausted error could not be forced; `Blocked` maps to `quota` per the API docs and is unit tested.
- [x] Claude Code CLI: flags, tools off, model choice, no sign-in behavior verified on Linux (table above). Windows path resolution moves to S13 (ADR-0026).
- [x] Extension IDs for the setup view's "Install" links: GitHub Copilot is `GitHub.copilot-chat` (built into VS Code 1.142 and needs `^1.142.0`, so Copilot Free users are on 1.142 or later); Claude Code is `anthropic.claude-code`.
- [x] Time to first token on a 300-line file with the walkthrough protocol: Claude Code median 5.9 s (5.7, 5.9, 8.0 s; includes CLI start), Copilot `Auto` 4.9 s (200-line files: 7.0 and 11.6 s). Both are near or above the 5 s median target in spec §12; track in S2 and S9.
- [x] Protocol trial (ADR-0007), prompt with the arch §5 format and one example: Claude Code on 4 files (135 to 301 lines) and Copilot `Auto` on 3 files (200 to 301 lines). Every response started with `@@overview`, had only well-formed `@@step N | L… | Title` headers (90 of 90 steps), no ranges outside the file, `@@summary`, `@@watch`, and a final `@@end`, and no code fences. Parser fixtures should still cover missing `@@end`, prose before the first tag, and fenced output, which neither model produced.

Record results in this file and resolve ADR-0017.

All S0 items are done. Spike code was throwaway and is not in the repository.

## S7 spike checklist (after release)

- [ ] `vscode.lm` in Cursor, Kiro, Windsurf, VSCodium: does it exist, does it return any models?
- [ ] Codex CLI: flags, tools off, model choice, no sign-in behavior, Windows.
- [ ] Gemini CLI: same.
- [ ] Kiro CLI: does a non-interactive mode exist; flags; auth. Resolve ADR-0016.
- [ ] Extension IDs of Codex and Kiro extensions for "Install" links.
- [ ] Time to first token for each on a 300-line file.
