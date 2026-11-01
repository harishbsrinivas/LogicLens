# 8. Security Controls

Rules are in `SECURITY.md`; this maps each risk to the control that enforces it.

| Risk | Control | Where |
|---|---|---|
| Code sent without the user meaning to | Only command and UI handlers create requests; all go through `RequestGate.send()`; lint rule bans other imports of providers; integration test asserts zero requests during open, switch, edit, save | `src/guard/`, `eslint.config.mjs`, `test/integration/explainFile.test.ts` |
| Use without accepting liability terms and policy obligations | `RequestGate` checks the accepted `TERMS.md` version first; modal with I Agree, View Full Terms, Cancel; nothing sent until accepted (ADR-0024) | `src/guard/terms.ts`, `TERMS.md` |
| Secrets in sent code | Exclusion globs, `.logiclensignore`, secret-file name guard, deterministic content scan that withholds lines or refuses (no send-anyway, no off switch) | `src/guard/exclude.ts`, `src/guard/secretScan.ts` |
| Secrets persisted locally | Withheld lines stored as hashes in cache and bookmarks; never shown in an explanation or logged | `src/cache/`, `src/bookmarks/`, `src/util/log.ts` |
| Malicious repository redirects requests or binaries | CLI paths and base URLs are `machine` scope; `logiclens.exclude` merges rather than replaces; untrusted workspaces blocked | `package.json` setting scopes, `src/guard/settings.ts`, `src/guard/trust.ts` |
| CLI agent edits files or runs commands | Tools disabled flags; isolated empty cwd; minimal env; argument arrays; `shell: false`; timeout; output cap; kill tree on cancel | `src/providers/cli/spawn.ts` |
| Command injection through code or questions | Content only on stdin or HTTP body, never in argv or a shell | same |
| API key leakage | `SecretStorage` only; redacting logger; keys never shown in the UI; env var only for the spawned child if a CLI needs one | `src/util/log.ts`, `src/providers/http/` |
| Active content in model output | No webview (ADR-0028). Output is a `MarkdownString` rendered by VS Code with `isTrusted`, `supportHtml`, and `supportThemeIcons` off, so no command links, HTML, or icons. Before that, images become links (nothing loads on render, so no exfiltration by image URL) and links, reference definitions, and autolinks that are not http(s) become text. Clicking an http(s) link goes through VS Code's link protection | `src/ui/safeMarkdown.ts`, `src/ui/inlineThreads.ts` |
| Command links in rendered output | Model output never carries command links: `safeMarkdown` turns every non-http(s) link into text first. Links LogicLens adds afterwards use `isTrusted: { enabledCommands: [...] }` naming one command each: `logiclens.revealLine` (answers; args `[documentKey, line]`, line checked against the open document) and `logiclens.askConcept` (step bodies; args `[documentKey, stepIndex, conceptIndex]`, concept text looked up in the session; only opens a pre-filled input box). Neither sends anything by itself | `src/ui/lineLinks.ts`, `src/ui/inlineThreads.ts`, `src/commands/questions.ts` |
| Thread actions acting on the wrong file | Thread title commands resolve their target from the thread's URI against open editors only; they take no paths or commands from content | `src/commands/explain.ts` |
| Prompt injection inside code | No action is ever taken on model output; output rendered as text; ranges clamped | `src/explain/anchor.ts` |
| Supply chain | Few runtime deps, lockfile, `pnpm audit` in CI, pinned Actions, publish tokens scoped to CI | `.github/workflows/` |
| Sensitive data in logs | Default log has metadata only; prompts and responses only with `logiclens.debug.logPrompts` (application scope) | `src/util/log.ts` |

## Secret scan (ADR-0020)

Local, deterministic, no model involved. `guard/secretScan.ts` is a pure function `scan(lines) → { flagged: {line, pattern}[] }` with no VS Code imports.

Patterns:
- Private key blocks: `-----BEGIN [A-Z ]*PRIVATE KEY-----` through the matching `END` line; every line in the block is flagged.
- Known formats: AWS access key IDs (`AKIA`/`ASIA` + 16), GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), GitLab (`glpat-`), Slack (`xox[abprs]-`), Stripe (`sk_live_`, `rk_live_`), Google API keys (`AIza` + 35), Anthropic (`sk-ant-`), OpenAI (`sk-` and `sk-proj-` forms), JWTs (three base64url segments starting `eyJ`).
- Credential URLs: `[a-z][a-z0-9+.-]*://[^\s:/@]+:[^\s@]+@`.
- Keyword assignments: name matching `(key|secret|token|passw(or)?d|credential|auth)` (case-insensitive) assigned with `=`, `:`, or `=>` to a quoted literal of 16+ characters whose Shannon entropy is above a threshold tuned on fixtures (initially 3.5 bits per character).
- Allowlist: documented example values (for example `AKIAIOSFODNN7EXAMPLE`) and placeholders (`<…>`, `${…}`, runs of `x` or `*`, `changeme`, `example`, `dummy`).

Runs on the target lines before context building (to withhold or refuse) and again on the exact outgoing text after it, so nothing added by prompt building or missed by truncation slips through; a hit on the second pass refuses the request.

Exclusion matching fails closed for documents outside the `file` scheme (diff views and similar): their path is still matched against the globs; `.logiclensignore` applies only inside a workspace folder. Untitled documents have no path and are matched by content only (the secret scan). Withholding replaces the whole line in the outgoing text only; the document is never changed. A target whose withheld lines exceed 25% of its non-blank lines is refused. The result passed onward carries line numbers and pattern names only.
