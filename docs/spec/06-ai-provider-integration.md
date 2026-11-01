# 6. AI Provider Integration

LogicLens has no model of its own. It uses an AI tool the user already has. A **provider** is one way of reaching a model; each provider may offer several **models**.

## Supported providers

Ordered by preference when auto-selecting (see Selection). Each is delivered in the slice shown (plan S<N>).

**MVP scope (ADR-0025):** only VS Code Language Models, tested against the **GitHub Copilot Free** plan, and Claude Code ship in the first release. The remaining rows are delivered in S7, after S12. Until then they do not appear in the picker, the setup view, or the `logiclens.provider` enum.

| Provider | How LogicLens reaches it | What the user needs | Slice |
|---|---|---|---|
| **VS Code Language Models** | VS Code Language Model API (`vscode.lm`). Lists every chat model any installed extension contributes: GitHub Copilot (which offers Claude, GPT, and Gemini models depending on the user's plan) and any other extension that registers a language model provider. | GitHub Copilot signed in; the Free plan is enough. VS Code shows its own consent prompt the first time LogicLens uses a model. Paid plans and other extensions that contribute models use the same API and are not blocked, but only Copilot Free is tested for the MVP. | S1 |
| **Claude Code** | The `claude` CLI in headless print mode, reading the prompt on stdin, with tools disabled. | Claude Code installed and signed in (subscription or API key it already holds). | S6 |
| **OpenAI Codex** | The `codex` CLI in non-interactive exec mode, read-only sandbox. | Codex CLI installed and signed in (ChatGPT plan or API key it already holds). | S7 (post-release) |
| **Gemini CLI** | The `gemini` CLI in non-interactive mode. | Gemini CLI installed and signed in. | S7 (post-release) |
| **Kiro** | Inside the Kiro IDE: through `vscode.lm` if Kiro exposes its models there. Otherwise the Kiro CLI in non-interactive mode, if it supports one. To be confirmed in S7 (ADR-0016). | Kiro IDE or Kiro CLI, signed in. | S7 (post-release, pending investigation) |
| **Anthropic API** | HTTPS to the Anthropic Messages API with the user's key. | An API key, stored in VS Code secret storage. | S7 (post-release) |
| **OpenAI API** (ChatGPT models) | HTTPS to the OpenAI API with the user's key. | An API key, stored in VS Code secret storage. | S7 (post-release) |
| **Ollama** (local) | HTTP to a local Ollama server. Code never leaves the machine. | Ollama running with a model pulled. | S7 (post-release) |

"ChatGPT" as a consumer app has no programmatic interface. Users reach OpenAI models through Copilot (`vscode.lm`), the Codex CLI with their ChatGPT sign-in, or an OpenAI API key.

Exact flags for Claude Code and `vscode.lm` behavior with Copilot Free are verified in the S0 spike; the other CLIs and Kiro's integration surface are verified in S7. Results are recorded in arch §4. The spec does not depend on any one CLI flag.

## Detection

On activation and when the provider picker opens, LogicLens checks without sending code:

- `vscode.lm.selectChatModels()` for available models (no request is made; listing is free).
- Each CLI's binary on `PATH` or at its configured path, and its version (`--version`).
- Whether an API key is stored for each HTTP provider.
- Whether Ollama answers on its configured URL.

Each provider shows a state: **Ready**, **Needs sign-in**, **Not installed**, or **Unavailable** with a reason. Detection runs again when the user opens the picker and when relevant settings change. It never prompts for sign-in on its own.

## Selection

- **First run:** if exactly one provider is Ready, LogicLens uses it and says so in a notification. If several are Ready, it shows the picker. If none are, a notification says so and opens the provider picker, which lists each provider's state with one action to install or configure it; the status bar item shows a warning until one is Ready.
- **After that:** `logiclens.provider` and `logiclens.model` hold the choice (`auto` by default, meaning the first Ready provider in the table order and that provider's default model).
- **Status bar item** shows the current provider and model ("✦ Copilot · claude-sonnet"); clicking it opens the picker (J5).
- **Per request override:** the explanation thread's title has a **Regenerate with…** action that regenerates the current walkthrough with another provider, which is useful for comparing.
- Model names are never hardcoded as defaults in the extension. Each adapter uses the provider's own default unless the user picks a model. For VS Code Language Models, where the API has no default, LogicLens prefers Copilot's chat models and, among them, the one with the largest input window (arch §4).

## Fallback and errors

- If the chosen provider fails before any output (not signed in, quota, CLI missing), LogicLens shows the error with one action to fix it (sign in, open settings, pick another provider). It does not silently switch providers, because switching changes where code is sent.
- If it fails mid-stream, partial output stays and **Retry** or **Continue** is offered (spec §4).
- Rate limit and quota errors show the provider's message and when to retry, if known. Copilot Free has a monthly chat quota; when it runs out, the message says so and offers Claude Code as an alternative if it is Ready, without switching automatically.

## Cost transparency

- After each request the explanation's header line shows the provider, model, duration, and token counts when the provider reports them.
- LogicLens never shows a price estimate it cannot verify.
