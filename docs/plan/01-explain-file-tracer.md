# S1. Explain File (Tracer Bullet)

**Status:** In progress. All tasks done; unit (116) and integration (9, VS Code 1.90.0, Linux) tests pass locally. Exit check open: the demo script needs a real Copilot Free sign-in on Linux, and CI has not yet run on a pull request.
**User value:** with GitHub Copilot (the Free plan is enough; ADR-0025) installed, a user runs "LogicLens: Explain File" and reads a streamed explanation of the active file in a side panel.
**Spec:** §3 (file target only), §6 (`vscode-lm` only), §7 (panel basics), §8 (terms of use, notice, trust, exclusions, secret scan)

## Scope

In:
- Command `logiclens.explainFile` from the palette and editor title button, for the active editor only.
- `RequestGate` with: terms-of-use acceptance (`TERMS.md` version, ADR-0024), workspace trust check, `logiclens.exclude` defaults plus `.logiclensignore`, size limit, one-time data notice (a single notice for now; per-provider in S5), deterministic secret scan that withholds flagged lines or refuses the file (`logiclens.secrets.action`, ADR-0020; no send-anyway).
- Context builder with line numbers (no budgeting beyond the size limit yet).
- `vscode-lm` adapter: first available model, stream text, map errors.
- Prompt asks for a plain Markdown explanation (not the step protocol yet).
- Panel webview view: empty state with "Explain this file", streaming Markdown, Stop, footer with provider/model/duration. Sanitized rendering and strict CSP.
- Command `logiclens.viewTerms`; panel "Accept the terms" state with Review Terms.
- Status bar busy indicator (static label, no picker).
- Output channel with redacting logger.

Out: steps, highlighting, selection, Explorer menu, questions, provider picker, cache.

## Tasks

- [x] `providers/types.ts`, `providers/vscodeLm.ts` with unit tests using a fake `LanguageModelChat`.
- [x] `guard/terms.ts`: version check, modal, `termsAccepted` in global state; unit tests for accept, cancel, view, and version bump.
- [x] `guard/` modules: trust, exclude, size, notice, secretScan; unit tests with fixtures (including false-positive fixtures of normal code).
- [x] Secret scan: one fixture per pattern, PEM blocks across lines, placeholder allowlist, 25% refuse threshold, withheld marker keeps line numbers, flagged values absent from logs and webview messages.
- [x] Panel notice listing withheld lines; gutter lock icon on withheld lines.
- [x] `explain/context.ts` line numbering; unit tests.
- [x] `prompts/explainMarkdown.ts` v1.
- [x] `ui/panel.ts` webview view provider, CSP with nonce, message bridge with `ready`, `explain`, `stop`, `state`, `delta`, `status`.
- [x] Webview: Svelte app with empty, streaming, done, error states; Markdown renderer with HTML disabled plus sanitizer; theme variables only.
- [x] Cancellation from Stop through to `sendRequest`.
- [x] Integration tests with `FakeProvider`: happy path, cancelled, excluded file refused, untrusted workspace refused, terms not accepted refused (nothing sent), secret masked, **no request on open/switch/edit/save**.
- [x] Webview sanitization tests (script tags, event handlers, `javascript:` links).
- [x] Update arch §3, §4, §6 with anything that changed.

## Demo script

1. Open a TypeScript file in a trusted workspace with Copilot Free signed in.
2. Click the LogicLens button in the editor title. Cancel the terms prompt and confirm nothing is sent; click again and choose I Agree. Accept the data notice and VS Code's model-access prompt.
3. Explanation streams into the panel within a few seconds. Footer shows the model.
4. Run again, press Stop midway; partial text stays, marked stopped.
5. Open `.env`; the command refuses with a link to settings.
6. Paste a fake AWS key into a file and explain it; the explanation arrives and the panel says "1 line withheld: possible secret on L<n>"; the debug log does not contain the key.
7. Set `logiclens.secrets.action` to `refuse-file` and explain again; nothing is sent and the matched line is listed.

## Progress notes

- Panel lives in an activity bar container: VS Code 1.90 cannot contribute to the secondary side bar (arch §6).
- `activate` returns a `TestApi` in test mode only; integration tests use it to swap in a fake provider and prompter and to override trust.
- The editor title button is hidden for excluded files via the `logiclens.fileExcluded` context key.
- Exclusion matching fails closed for non-`file` schemes (arch §8).
- Not yet verified by hand: the demo script against real Copilot models, light/dark/high-contrast rendering, and the model-access prompt order.

## Exit check

- [ ] Demo script passes in VS Code stable on Linux (ADR-0026).
- [ ] All tests green in CI.
- [x] No code path calls the provider outside `RequestGate` (lint rule active).
