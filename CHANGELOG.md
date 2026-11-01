# Changelog

## Unreleased

- Scope: the MVP targets VS Code stable on Linux only and publishes to the VS Code Marketplace only (ADR-0026, supersedes ADR-0012). Windows and macOS move to new slice S13; Open VSX and VS Code forks to S7.
- Renamed the product from Clarity to LogicLens; identifiers now use the `logiclens.` prefix (ADR-0018).
- Added `TERMS.md` and the terms-of-use acceptance gate to the spec and plan (ADR-0024); the gate ships in S1.
- S0: repository skeleton, build, tests, CI, and a placeholder `LogicLens: Hello` command.
- Narrowed MVP providers to GitHub Copilot Free (through `vscode.lm`) and Claude Code; Codex, Gemini CLI, Kiro, API keys, Ollama, and fork checks moved to S7, after S12 (ADR-0025).
