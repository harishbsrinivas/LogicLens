# S1. Explain File (Tracer Bullet)

**Status:** In progress. Panel replaced by an inline explanation thread (ADR-0028); unit (96) and integration (11, VS Code 1.90.0, Linux) tests pass locally. Exit check open: the demo script needs a real Copilot Free sign-in on Linux.
**User value:** with GitHub Copilot (the Free plan is enough; ADR-0025) installed, a user runs "LogicLens: Explain File" and reads a streamed explanation of the active file inline, at the top of the file, over the code.
**Spec:** §3 (file target only), §6 (`vscode-lm` only), §7 (inline explanation thread), §8 (terms of use, notice, trust, exclusions, secret scan)

## Scope

In:
- Command `logiclens.explainFile` from the palette and editor title button, for the active editor only.
- `RequestGate` with: terms-of-use acceptance (`TERMS.md` version, ADR-0024), workspace trust check, `logiclens.exclude` defaults plus `.logiclensignore`, size limit, one-time data notice (a single notice for now; per-provider in S5), deterministic secret scan that withholds flagged lines or refuses the file (`logiclens.secrets.action`, ADR-0020; no send-anyway).
- Context builder with line numbers (no budgeting beyond the size limit yet).
- `vscode-lm` adapter: first available model, stream text, map errors.
- Prompt asks for a plain Markdown explanation (not the step protocol yet).
- Inline explanation thread at line 1 (Comments API, ADR-0028): streaming Markdown, header with provider/model/duration, title actions Stop, Explain again, and Close. Model output rendered with HTML, command links, and images off.
- Commands `logiclens.viewTerms` and `logiclens.closeExplanation`.
- Status bar busy indicator (static label, no picker).
- Output channel with redacting logger.

Out: steps, highlighting, selection, Explorer menu, questions, provider picker, cache.

## Tasks

- [x] `providers/types.ts`, `providers/vscodeLm.ts` with unit tests using a fake `LanguageModelChat`.
- [x] `guard/terms.ts`: version check, modal, `termsAccepted` in global state; unit tests for accept, cancel, view, and version bump.
- [x] `guard/` modules: trust, exclude, size, notice, secretScan; unit tests with fixtures (including false-positive fixtures of normal code).
- [x] Secret scan: one fixture per pattern, PEM blocks across lines, placeholder allowlist, 25% refuse threshold, withheld marker keeps line numbers, flagged values absent from logs and the inline explanation.
- [x] Notice listing withheld lines; gutter lock icon on withheld lines.
- [x] `explain/context.ts` line numbering; unit tests.
- [x] `prompts/explainMarkdown.ts` v1.
- [x] ~~`ui/panel.ts` webview view and Svelte app~~ (built, then replaced by ADR-0028).
- [x] `ui/inlineThreads.ts`: comment controller, thread at line 1, streaming body (about 100 ms), status labels, title actions via `contextValue`.
- [x] `ui/safeMarkdown.ts`: images to links, non-http(s) links, reference definitions, and autolinks to text; unit tests.
- [x] Remove the webview, Svelte, Vite, markdown-it, and DOMPurify.
- [x] Cancellation from Stop through to `sendRequest`.
- [x] Integration tests with `FakeProvider`: happy path, cancelled, excluded file refused, untrusted workspace refused, terms not accepted refused (nothing sent), secret masked, **no request on open/switch/edit/save**.
- [x] Rendering safety tests (`command:` and `javascript:` links, images, HTML) in unit and integration tests.
- [x] Update arch §3, §4, §6 with anything that changed.

## Demo script

1. Open a TypeScript file in a trusted workspace with Copilot Free signed in.
2. Click the LogicLens button in the editor title. Cancel the terms prompt and confirm nothing is sent; click again and choose I Agree. Accept the data notice and VS Code's model-access prompt.
3. The editor scrolls to the top and the explanation streams into an inline block under line 1 within a few seconds. Its header shows LogicLens, the provider, and the model.
4. Run again, press Stop in the block's title midway; partial text stays, marked stopped. **Explain again** appears in its place.
5. Click Close in the block's title; the explanation disappears.
6. Open `.env`; the command refuses with a link to settings.
7. Paste a fake AWS key into a file and explain it; the explanation arrives and starts with "1 line withheld: possible secret on L<n>"; the debug log does not contain the key.
8. Set `logiclens.secrets.action` to `refuse-file` and explain again; nothing is sent and the matched line is listed.

## Progress notes

- `activate` returns a `TestApi` in test mode only; integration tests use it to swap in a fake provider and prompter and to override trust.
- The editor title button is hidden for excluded files via the `logiclens.fileExcluded` context key.
- Exclusion matching fails closed for non-`file` schemes (arch §8).
- 2026-11-01: the S0 spike found the `vscode-lm` adapter would have picked an agent-backed `copilotcli` model first and could confuse models sharing the ID `auto`. Fixed: Copilot chat models rank first, then by input window; model keys are `vendor/id`. The real adapter was then run against Copilot Free in VS Code 1.142: it lists models, streams, and maps Stop to `cancelled`.
- 2026-11-01: the owner asked for explanations over the code instead of a side panel. ADR-0028 supersedes ADR-0009: the explanation is now a read-only comment thread at line 1, and the webview and its dependencies are gone. Integration tests read thread snapshots through the `TestApi`.
- Still manual: the demo script itself, which needs a person to answer the terms, notice, and access prompts.

## Exit check

- [ ] Demo script passes in VS Code stable on Linux (ADR-0026).
- [x] All tests green in CI (PR #5).
- [x] No code path calls the provider outside `RequestGate` (lint rule active).
