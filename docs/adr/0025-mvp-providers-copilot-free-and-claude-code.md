# ADR-0025: MVP providers: Copilot Free through `vscode.lm`, and Claude Code

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6, §11, §12; plan S0, S6, S7, S9

## Context
The plan delivered eight providers before the first release (spec §6). The S0 spike stalled because the S0 machine has only Claude Code and VS Code; Codex, Gemini CLI, Kiro, the forks, and paid Copilot plans could not be checked. Every extra provider before release adds an adapter, fixtures, eval runs, a Windows check, and a data notice, and delays the two headline features.

## Decision
The MVP (S0 to S11, released in S9) supports two providers:

1. **VS Code Language Models (`vscode-lm`)**, verified against the **GitHub Copilot Free** plan in VS Code stable. The adapter does not filter by vendor or plan, so paid Copilot plans and other extensions that contribute models may appear and work, but only Copilot Free is tested and claimed.
2. **Claude Code CLI (`claude-code`)**, headless with tools off (ADR-0005).

Codex CLI, Gemini CLI, Kiro, the Anthropic and OpenAI API adapters, Ollama, and fork compatibility checks (Cursor, Kiro, Windsurf, VSCodium) move to S7, which runs after S12, the last planned slice.

## Alternatives considered
- Keep all eight providers in the MVP: blocks S0 on tools that are not available and lengthens the path to release.
- Claude Code only: excludes the zero-install path for most VS Code users; Copilot Free needs no payment.
- Test against paid Copilot plans: needs a subscription the project does not have; Free exercises the same API.

## Consequences
- S0 exit no longer waits on Codex, Gemini, Kiro, or forks. ADR-0016 (Kiro) moves to S7.
- Copilot Free has a small monthly chat quota and a limited model list. Quota exhaustion must map to the `quota` error with a clear message, and the eval and smoke runs must fit within the quota or use Claude Code.
- Users without Copilot or Claude Code have no working provider at release; the setup view says so and links to both.
- ADR-0006 (HTTP adapters) and the deferred rows of spec §6 stay valid; only their timing changes.
- The release listing and README name only the two supported providers.
