# S1. Explain File (Tracer Bullet)

**Status:** Not started
**User value:** with GitHub Copilot (or any extension that contributes language models) installed, a user runs "Clarity: Explain File" and reads a streamed explanation of the active file in a side panel.
**Spec:** §3 (file target only), §6 (`vscode-lm` only), §7 (panel basics), §8 (notice, trust, exclusions, secret scan)

## Scope

In:
- Command `clarity.explainFile` from the palette and editor title button, for the active editor only.
- `RequestGate` with: workspace trust check, `clarity.exclude` defaults plus `.clarityignore`, size limit, one-time data notice (a single notice for now; per-provider in S5), secret scan with mask/send/cancel.
- Context builder with line numbers (no budgeting beyond the size limit yet).
- `vscode-lm` adapter: first available model, stream text, map errors.
- Prompt asks for a plain Markdown explanation (not the step protocol yet).
- Panel webview view: empty state with "Explain this file", streaming Markdown, Stop, footer with provider/model/duration. Sanitized rendering and strict CSP.
- Status bar busy indicator (static label, no picker).
- Output channel with redacting logger.

Out: steps, highlighting, selection, Explorer menu, questions, provider picker, cache.

## Tasks

- [ ] `providers/types.ts`, `providers/vscodeLm.ts` with unit tests using a fake `LanguageModelChat`.
- [ ] `guard/` modules: trust, exclude, size, notice, secretScan; unit tests with fixtures (including false-positive fixtures of normal code).
- [ ] `explain/context.ts` line numbering; unit tests.
- [ ] `prompts/explainMarkdown.ts` v1.
- [ ] `ui/panel.ts` webview view provider, CSP with nonce, message bridge with `ready`, `explain`, `stop`, `state`, `delta`, `status`.
- [ ] Webview: Svelte app with empty, streaming, done, error states; Markdown renderer with HTML disabled plus sanitizer; theme variables only.
- [ ] Cancellation from Stop through to `sendRequest`.
- [ ] Integration tests with `FakeProvider`: happy path, cancelled, excluded file refused, untrusted workspace refused, secret masked, **no request on open/switch/edit/save**.
- [ ] Webview sanitization tests (script tags, event handlers, `javascript:` links).
- [ ] Update arch §3, §4, §6 with anything that changed.

## Demo script

1. Open a TypeScript file in a trusted workspace with Copilot signed in.
2. Click the Clarity button in the editor title. Accept the data notice and VS Code's model-access prompt.
3. Explanation streams into the panel within a few seconds. Footer shows the model.
4. Run again, press Stop midway; partial text stays, marked stopped.
5. Open `.env`; the command refuses with a link to settings.
6. Paste a fake AWS key into a file and explain it; the secret prompt appears; choose mask.

## Exit check

- [ ] Demo script passes on Linux and one of Windows or macOS.
- [ ] All tests green in CI.
- [ ] No code path calls the provider outside `RequestGate` (lint rule active).
