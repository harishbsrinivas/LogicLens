# 8. Privacy, Trust, and Consent

LogicLens sends the user's code to a model. Users must always know when, what, and where. `SECURITY.md` §1 holds the enforceable rules; this section is the product behavior.

## When code is sent

Only after an explicit action: running an explain command, clicking an explain or refresh button, clicking a CodeLens, or submitting a question. Never on file open, tab switch, save, cursor move, or activation. Detection (spec §6) never sends code.

## What is sent

- The target (file, selection, symbol, or line context; spec §3, §5).
- The file's workspace-relative path and language ID.
- For questions: prior turns in the thread and the related walkthrough step.
- Nothing else in the MVP. Cross-file context (definitions of imported symbols) is a post-MVP candidate and, if added, is off by default and listed in the data notice.

## Where it goes

To the chosen provider only (spec §6). LogicLens has no server and keeps no copy outside the user's machine. What happens next is governed by the provider's terms, which the data notice links to.

## Terms of use

Before LogicLens sends anything for the first time, the user must accept its terms of use (`TERMS.md`, ADR-0024). The prompt appears on the first explicit action, not on install or activation, and comes before the data notice. It is a modal:

> **LogicLens Terms of Use.** By continuing you agree that:
> - LogicLens is provided "as is", without warranty. Its developers are not liable for any damage or loss arising from its use, including code you send to an AI provider and any reliance on its explanations.
> - You are bound by your organization's IT, security, and AI-usage policies, and you are responsible for following them.
> - You will not use LogicLens with internal, confidential, highly confidential, restricted, eyes-only, or similarly classified code or documents, or any code you are not authorized to share with your AI provider.
>
> [I Agree] [View Full Terms] [Cancel]

- Only **I Agree** records acceptance. **View Full Terms** opens `TERMS.md` and sends nothing; Cancel sends nothing. Until the user agrees, every explain or question action shows the prompt again. **LogicLens: View Terms of Use** opens the terms at any time.
- Acceptance is stored once per user in global state with the terms version. When the terms change, the version changes and the user is asked again.
- "LogicLens: Reset Data Notices" does not clear it. "LogicLens: View Terms of Use" opens the terms at any time.
- LogicLens cannot tell whether code is confidential. Exclusions and the secret scan reduce risk but do not replace the user's own judgment or their organization's policies.

## One-time data notice

Before the first request to each provider, a modal notice says:

> LogicLens will send the selected code and your questions to **<Provider>** to generate explanations. LogicLens has no server of its own. <Provider>'s terms apply. [View terms] [Continue] [Cancel]

The acknowledgement is stored per provider in global state. "LogicLens: Reset Data Notices" clears it. For `vscode.lm` providers, VS Code also shows its own language-model access prompt; LogicLens's notice appears first.

For Ollama, the notice says code stays on the machine, and the notice is skipped if the configured URL is `localhost` or `127.0.0.1`.

## Exclusions

- `logiclens.exclude`: glob patterns (default includes `**/.env*`, `**/*.pem`, `**/*.key`, `**/id_rsa*`, `**/secrets/**`, `**/*.tfvars`).
- `.logiclensignore` at the workspace root, gitignore syntax.
- Excluded files show "Excluded by LogicLens settings" instead of explain actions, and the commands refuse them with a link to the setting.
## Hardcoded secrets

LogicLens checks every outgoing request for hardcoded secrets and never sends a line it flags (ADR-0020).

**How detection works.** Detection is local and deterministic: regular expressions for known key formats plus an entropy check, run on the machine. LogicLens never asks an AI model to find secrets, because that would mean sending the secret to find it. The scan looks for:

- private key blocks (`-----BEGIN … PRIVATE KEY-----` through the matching `END` line),
- known token formats: cloud provider access keys, GitHub, GitLab, Slack, Stripe, Google, Anthropic, and OpenAI keys, JWTs,
- connection strings and URLs with embedded credentials (`scheme://user:password@host`),
- assignments whose name contains `key`, `secret`, `token`, `password`, `passwd`, `credential`, or `auth`, when the value is a string literal of 16 or more characters above an entropy threshold.

Well-known documentation placeholders (for example AWS's `AKIAIOSFODNN7EXAMPLE`) and obvious placeholders (`<your-key>`, `xxxx…`, `changeme`) are not flagged.

**What happens on a match.** Set by `logiclens.secrets.action` (application scope):

- `skip-lines` (default): each flagged line, or the whole block for a private key, is replaced in the outgoing text by `«line withheld by LogicLens: possible secret»`, keeping its line number so steps still anchor. The prompt tells the model that withheld lines exist and not to guess their content. The rest of the file is sent.
- `refuse-file`: nothing is sent. LogicLens shows which lines matched and offers **Skip those lines instead** for this request.

Either way, the explanation shows a notice such as "2 lines withheld: possible secrets on L12, L40", and the editor marks them with a lock icon in the gutter while the walkthrough is open.

- If withheld lines make up more than 25% of the target's non-blank lines, the file is treated as a secrets file and refused even under `skip-lines`.
- There is no "send anyway" and no setting that turns the scan off. A false positive costs one line of context; a false negative leaks a credential.
- The same scan runs on question context and earlier thread turns. If the user's own typed question contains a match, the question is not sent and LogicLens asks them to remove the value.
- Flagged values never reach logs (including the debug channel), the inline explanation, the cache, or bookmarks. Logs record only the line number and pattern name.

## Workspace trust

- In a restricted (untrusted) workspace, LogicLens's commands are visible but disabled with an explanation, and nothing is sent. The extension declares limited support for untrusted workspaces.
- CLI binary paths and API base URLs cannot be set in workspace settings (spec §9), so a cloned repo cannot redirect requests.

## Local storage

- Cached walkthroughs and threads are stored in the extension's workspace storage on disk, never in the repository.
- `logiclens.cache.enabled` (default on) controls this. "LogicLens: Clear Cache" deletes it.
- Bookmarks (spec §14) are stored in the same place but separately; "LogicLens: Clear All Bookmarks" deletes them.
- The navigation trail (spec §13) is kept in workspace state and holds file paths and positions only, no code.
- API keys are stored in VS Code secret storage only.

## Telemetry

None in the MVP. LogicLens sends nothing to its authors.
