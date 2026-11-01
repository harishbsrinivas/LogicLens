# Security

Security rules for this project. Applies to humans and AI agents alike. `AGENTS.md` makes these rules mandatory for agents; [docs/architecture/08-security-controls.md](docs/architecture/08-security-controls.md) lists the controls that implement them. If this file and the architecture disagree, fix whichever is wrong in the same change.

Scope: a VS Code extension written in TypeScript, bundled with esbuild, with inline editor UI and one settings-only webview (ADR-0028, ADR-0031), that sends user-selected source code to AI providers the user already has (VS Code Language Model API, local provider CLIs, or HTTP APIs with a user-supplied key).

## Reporting a vulnerability

- Do not open a public issue for a security problem.
- Use the repository host's private vulnerability reporting (TODO: enable before first Marketplace release).
- Target response: acknowledge within 3 business days, triage within 7.

## 1. What leaves the machine

This is the main risk in this product. User code is sent to a third-party model.

- Code is sent only after an explicit user action (a command, a click, a question). Never in the background, never on file open, never speculatively.
- Before the first request of any kind, the user must accept the current version of `TERMS.md` (no liability, bound by organizational policies, no internal or confidential code). No request is sent until they do (ADR-0024).
- Before the first request to each provider, show a one-time notice naming the provider and what will be sent. Record the acknowledgement per provider in global state (spec §8).
- Send only what the request needs: the target file or selection plus the context described in arch §5. Never send whole folders or the workspace by default.
- Respect `logiclens.exclude` globs and a `.logiclensignore` file. Excluded files are never read for context and cannot be explained.
- Refuse files that look like secrets (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials*`, `*.tfvars`, `*.kubeconfig`) unless the user overrides per file. Scan content about to be sent with local, deterministic patterns (never an AI model); withhold flagged lines or refuse the file. There is no "send anyway" (ADR-0020).
- In an untrusted workspace (Workspace Trust restricted mode), the extension does not send code anywhere.

## 2. Secrets and credentials

- No secrets in git, ever.
- User API keys are stored only in `context.secrets` (VS Code `SecretStorage`). Never in `settings.json`, workspace state, global state, explanations, logs, or error messages.
- Never pass an API key on a CLI argument list. Pass via environment variable to the child process if the CLI requires one, scoped to that spawn.
- Redact anything matching a key pattern before writing to the debug output channel.
- Run `gitleaks detect --no-banner` before every commit and in CI.
- If a real secret is committed: rotate first, then remove from history.

## 3. Dependencies and supply chain

- pnpm only. Commit `pnpm-lock.yaml`; CI installs with `pnpm install --frozen-lockfile`.
- `pnpm audit --audit-level=high` fails CI on high or critical advisories.
- Keep runtime dependencies few. Prefer VS Code APIs and the Node standard library. Each new runtime dependency needs a line in the PR explaining why.
- Pin GitHub Actions to a full commit SHA. Default workflow `permissions: contents: read`.
- Marketplace (and, from S7, Open VSX) publish tokens live only in CI secrets, scoped to publishing.

## 4. Rendering model output

- Explanations never use a webview (ADR-0028). The settings page is the one webview (ADR-0031): strict CSP with a per-load nonce, no inline scripts or styles, no remote resources, DOM built with `textContent`, and every message validated against `settings/schema.ts`. It never receives code, prompts, model output, or keys. Any other webview needs a new ADR.
- Model output is shown only as a `vscode.MarkdownString` with `isTrusted`, `supportHtml`, and `supportThemeIcons` set to `false`. Never set `isTrusted: true` on a string that contains model output; if a later slice needs command links next to model text, use `isTrusted: { enabledCommands: [...] }` with commands that validate their arguments.
- Before rendering, pass model output through `ui/safeMarkdown.ts`: images become links (nothing loads on render), and links, reference definitions, and autolinks that are not http(s) become plain text.
- Commands run from thread actions resolve their target from the thread's document among open editors; they never take a file path or command from content.

## 5. Provider CLIs and processes

- Spawn with `child_process.spawn(binary, args, { shell: false })`. Never `exec` and never a shell string.
- Resolve the binary from the user setting or `PATH` once, show the resolved path in the provider picker, and never take a binary path from workspace settings (a malicious repo could point it at its own script). CLI path settings are `machine` or `application` scope only.
- Pass code and prompts on stdin. Arguments contain only fixed flags.
- Run CLIs in a read-only or no-tool mode where the CLI supports it, so the explanation request cannot edit files or run commands (arch §4). If a CLI cannot be restricted, document that in its adapter and in the provider notice.
- Enforce a timeout and an output size cap; kill the process tree on cancel.

## 6. Model output

- Treat model output as untrusted. Never execute it, never apply it as an edit, never use it to pick files or commands.
- Line ranges returned by the model are clamped to the document and ignored if invalid.
- Prompt injection inside user code (for example a comment saying "ignore previous instructions") can change the explanation but must not be able to cause any action beyond rendering text. This holds because the extension takes no actions on model output.

## 7. Telemetry and logging

- No telemetry in the MVP. If added later it must respect `vscode.env.isTelemetryEnabled`, need an ADR, and never include code, prompts, responses, file paths, or keys.
- The output channel logs provider, model, timings, token counts, and errors. Code, prompts, and responses are logged only when `logiclens.debug.logPrompts` is on, and that setting is off by default and `application` scope.

## Pre-merge checklist

- [ ] No new path sends code without an explicit user action.
- [ ] Exclusion rules and the secrets-file guard apply to the new path.
- [ ] No API key outside `SecretStorage`; no key in logs.
- [ ] CLI spawns use argument arrays, stdin for content, timeout, and cancel.
- [ ] Model output still rendered only through `safeMarkdown` into an untrusted `MarkdownString`; no webview added without an ADR; the settings page still validates every message and its CSP is unchanged.
- [ ] `pnpm audit --audit-level=high` clean or exceptions documented.
- [ ] `gitleaks detect --no-banner` clean.
