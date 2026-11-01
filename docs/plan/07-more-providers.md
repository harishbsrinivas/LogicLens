# S7. More Providers (post-release)

**Status:** Not started. Deferred until after S12 (ADR-0025).
**User value:** users can use Codex CLI, Gemini CLI, Kiro, their own Anthropic or OpenAI API key (OpenAI covers "ChatGPT" models), or a local Ollama model that keeps code on the machine.
**Spec:** §6 (remaining rows), §8 (local Ollama notice), arch §7 (secrets)
**Timing:** after S12, the last pre-planned slice. Ships as minor releases.

This slice may be split into S7a (CLIs: Codex, Gemini, Kiro), S7b (HTTP: Anthropic, OpenAI, Ollama), and S7c (fork compatibility) if it grows past about a week.

## Scope

In:
- `http/sse.ts` shared streaming reader with cancel and timeout.
- `anthropic` adapter: key in `SecretStorage`, optional base URL (machine scope), model list, streaming, usage, error mapping.
- `openai` adapter: same; API flavor decided here (arch §10, open decision 6).
- `ollama` adapter: `/api/tags` detection, `/api/chat` streaming; notice skipped for localhost.
- `logiclens.setApiKey` command with validation call; delete key action.
- Spike for these providers, as S0 did for the MVP pair: headless flags, tools-off mode, auth errors, Windows behavior, protocol adherence, 300-line time to first token; record in arch §4 and update ADR-0005.
- `codex` adapter on the S6 spawn helper: `--sandbox read-only`, approvals never; `logiclens.cli.codexPath`.
- `gemini-cli` adapter on the S6 spawn helper; `logiclens.cli.geminiPath`.
- `kiro` adapter per ADR-0016 outcome: either confirm that the `vscode-lm` adapter covers Kiro inside the Kiro IDE (then this is a compatibility test only) or add a CLI adapter. If neither works, record that and drop Kiro from spec §6 and §11.
- Fork compatibility: `vscode.lm` in Cursor, Kiro, Windsurf, VSCodium (exists? returns models?); smoke test LogicLens in Cursor and Kiro; record in arch §4.
- Add the new enum values to `logiclens.provider` and the new settings in spec §9 and `package.json`.

## Tasks

- [ ] SSE reader unit tests with chunk-split fixtures.
- [ ] Recorded fixture tests for each adapter (success, 401, 429, 5xx, truncated).
- [ ] Redaction tests: keys never appear in logs, errors, or explanations.
- [ ] Setup view: "Set API key…" and "Is Ollama running?" guidance.
- [ ] Eval run per new provider; record rates in arch §4.

## Demo script

1. Run "Set API Key…", choose Anthropic, paste a key; it validates and the provider becomes Ready.
2. Explain a file with Anthropic; footer shows model and token usage.
3. Start Ollama with a code model; pick Ollama; no data notice appears for localhost; explain a file.
4. Pick Codex, then Gemini CLI; explain a file with each; press Stop during one request and confirm the process exits.
5. In the Kiro IDE, install the VSIX from Open VSX or locally and explain a file through whatever path ADR-0016 chose.
6. Run "Show Log"; confirm no key or code appears with debug logging off.

## Exit check

- [ ] Demo script passes (Kiro step per ADR-0016 outcome).
- [ ] All tests green.
