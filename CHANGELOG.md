# Changelog

## Unreleased

- Scope: the MVP targets VS Code stable on Linux only and publishes to the VS Code Marketplace only (ADR-0026, supersedes ADR-0012). Windows and macOS move to new slice S13; Open VSX and VS Code forks to S7.
- S1: **LogicLens: Explain File** streams a plain-Markdown explanation of the active file from VS Code language models (for example GitHub Copilot) into the new LogicLens panel, with Stop, a provider and model footer, and **LogicLens: View Terms of Use**.
- S1: every request goes through the request gate: terms of use, workspace trust, `logiclens.exclude` plus `.logiclensignore`, size limit, one-time data notice, and a local secret scan that withholds flagged lines (lock icon in the gutter, notice in the panel) or refuses under `logiclens.secrets.action: refuse-file`.
- S1: removed the S0 placeholder `LogicLens: Hello` command.
- S1: with Copilot, LogicLens now defaults to Copilot's chat model with the largest input window instead of the first model VS Code lists (which can be an agent-backed model).
- S0: feasibility spike complete for Copilot Free and Claude Code; the line-tagged protocol (ADR-0007) and the `^1.90.0` engine floor (ADR-0017) are accepted.
- Renamed the product from Clarity to LogicLens; identifiers now use the `logiclens.` prefix (ADR-0018).
- Added `TERMS.md` and the terms-of-use acceptance gate to the spec and plan (ADR-0024); the gate ships in S1.
- S0: repository skeleton, build, tests, CI, and a placeholder `LogicLens: Hello` command.
- Narrowed MVP providers to GitHub Copilot Free (through `vscode.lm`) and Claude Code; Codex, Gemini CLI, Kiro, API keys, Ollama, and fork checks moved to S7, after S12 (ADR-0025).
