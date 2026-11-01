# 8. Security Controls

Rules are in `SECURITY.md`; this maps each risk to the control that enforces it.

| Risk | Control | Where |
|---|---|---|
| Code sent without the user meaning to | Only command and UI handlers create requests; all go through `RequestGate.send()`; lint rule bans other imports of providers; integration test asserts zero requests during open, switch, edit, save | `src/guard/`, `eslint.config.js`, `test/integration/noImplicitSend.test.ts` |
| Secrets in sent code | Exclusion globs, `.clarityignore`, secret-file name guard, content secret scan with mask default | `src/guard/exclude.ts`, `src/guard/secretScan.ts` |
| Malicious repository redirects requests or binaries | CLI paths and base URLs are `machine` scope; `clarity.exclude` merges rather than replaces; untrusted workspaces blocked | `package.json` setting scopes, `src/guard/trust.ts` |
| CLI agent edits files or runs commands | Tools disabled flags; isolated empty cwd; minimal env; argument arrays; `shell: false`; timeout; output cap; kill tree on cancel | `src/providers/cli/spawn.ts` |
| Command injection through code or questions | Content only on stdin or HTTP body, never in argv or a shell | same |
| API key leakage | `SecretStorage` only; redacting logger; keys never posted to the webview; env var only for the spawned child if a CLI needs one | `src/util/log.ts`, `src/providers/http/` |
| XSS in webview from model output | Markdown renderer with HTML off, sanitizer, strict CSP with nonce, no remote sources, link scheme allowlist enforced in host | `webview/src/markdown.ts`, `src/ui/panel.ts` |
| Spoofed webview messages | Typed messages, session ID check, range and index validation in host | `src/ui/panel.ts` |
| Prompt injection inside code | No action is ever taken on model output; output rendered as text; ranges clamped | `src/explain/anchor.ts` |
| Supply chain | Few runtime deps, lockfile, `pnpm audit` in CI, pinned Actions, publish tokens scoped to CI | `.github/workflows/` |
| Sensitive data in logs | Default log has metadata only; prompts and responses only with `clarity.debug.logPrompts` (application scope) | `src/util/log.ts` |

## Secret scan

Patterns: private key headers, AWS access key IDs, GitHub tokens, Slack tokens, Google API keys, JWTs, Anthropic and OpenAI key prefixes, generic `(key|secret|token|password)\s*[:=]\s*<high-entropy string>`. Entropy threshold tuned on fixtures to keep false positives low on normal code. Runs on the exact outgoing text, after context building, so nothing is missed by truncation.

Masking replaces the matched value with `«redacted»` in the outgoing text only; the document is never changed.
