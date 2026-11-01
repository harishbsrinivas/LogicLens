# 8. Privacy, Trust, and Consent

Clarity sends the user's code to a model. Users must always know when, what, and where. `SECURITY.md` §1 holds the enforceable rules; this section is the product behavior.

## When code is sent

Only after an explicit action: running an explain command, clicking an explain or refresh button, clicking a CodeLens, or submitting a question. Never on file open, tab switch, save, cursor move, or activation. Detection (spec §6) never sends code.

## What is sent

- The target (file, selection, symbol, or line context; spec §3, §5).
- The file's workspace-relative path and language ID.
- For questions: prior turns in the thread and the related walkthrough step.
- Nothing else in the MVP. Cross-file context (definitions of imported symbols) is a post-MVP candidate and, if added, is off by default and listed in the data notice.

## Where it goes

To the chosen provider only (spec §6). Clarity has no server and keeps no copy outside the user's machine. What happens next is governed by the provider's terms, which the data notice links to.

## One-time data notice

Before the first request to each provider, a modal notice says:

> Clarity will send the selected code and your questions to **<Provider>** to generate explanations. Clarity has no server of its own. <Provider>'s terms apply. [View terms] [Continue] [Cancel]

The acknowledgement is stored per provider in global state. "Clarity: Reset Data Notices" clears it. For `vscode.lm` providers, VS Code also shows its own language-model access prompt; Clarity's notice appears first.

For Ollama, the notice says code stays on the machine, and the notice is skipped if the configured URL is `localhost` or `127.0.0.1`.

## Exclusions

- `clarity.exclude`: glob patterns (default includes `**/.env*`, `**/*.pem`, `**/*.key`, `**/id_rsa*`, `**/secrets/**`, `**/*.tfvars`).
- `.clarityignore` at the workspace root, gitignore syntax.
- Excluded files show "Excluded by Clarity settings" instead of explain actions, and the commands refuse them with a link to the setting.
- **Secret scan before send:** the outgoing text is scanned for common key formats (cloud provider keys, private key headers, JWTs, high-entropy tokens next to words like `key`, `secret`, `token`, `password`). On a hit, Clarity shows which lines matched and asks **Send anyway**, **Send with those lines masked**, or **Cancel**. Masking is the default action.

## Workspace trust

- In a restricted (untrusted) workspace, Clarity's commands are visible but disabled with an explanation, and nothing is sent. The extension declares limited support for untrusted workspaces.
- CLI binary paths and API base URLs cannot be set in workspace settings (spec §9), so a cloned repo cannot redirect requests.

## Local storage

- Cached walkthroughs and threads are stored in the extension's workspace storage on disk, never in the repository.
- `clarity.cache.enabled` (default on) controls this. "Clarity: Clear Cache" deletes it.
- API keys are stored in VS Code secret storage only.

## Telemetry

None in the MVP. Clarity sends nothing to its authors.
