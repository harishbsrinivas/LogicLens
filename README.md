# LogicLens

A VS Code extension that walks you through code step by step and answers questions about any line. It uses the AI assistant you already have instead of shipping its own model. The first release supports GitHub Copilot (the Free plan is enough) and Claude Code, in VS Code on Linux; Codex, Gemini CLI, Kiro, Ollama, your own API key, Windows and macOS, and VS Code forks come later.

**Status:** S1 in progress: "LogicLens: Explain File" streams a Markdown explanation from Copilot models inline at the top of the file. Not yet released.

## Terms of use

Using LogicLens means accepting [TERMS.md](TERMS.md): it is provided as is and its developers are not liable for damage arising from its use; you are bound by your organization's IT and usage policies; and you must not use it with internal, confidential, highly confidential, eyes-only, or similarly classified code or documents. LogicLens asks you to accept these terms before it sends anything.

## Docs

| Folder | What it answers |
|---|---|
| [docs/spec/](docs/spec/README.md) | What the product does and for whom |
| [docs/architecture/](docs/architecture/README.md) | How it is built |
| [docs/adr/](docs/adr/README.md) | Why it is built that way |
| [docs/plan/](docs/plan/README.md) | The order of work, in thin vertical slices |
| [SECURITY.md](SECURITY.md) | Security rules for contributors and agents |
| [AGENTS.md](AGENTS.md) | Mandatory rules for AI coding agents |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, branch-per-slice workflow, coding and testing practices |
