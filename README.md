# LogicLens

A VS Code extension that walks you through code step by step and answers questions about any line. It uses the AI assistant you already have instead of shipping its own model. The first release supports GitHub Copilot (the Free plan is enough) and Claude Code, in VS Code on Linux; Codex, Gemini CLI, Kiro, Ollama, your own API key, Windows and macOS, and VS Code forks come later.

**Status:** S1 to S6, S8, S10, S11, and S14 are implemented on stacked branches and pass their automated tests; their manual demo scripts are still to be run. Not yet released.

## Settings

Run **LogicLens: Open Settings** for one page with every LogicLens setting, the state of each AI provider, and related actions (clear cache, reset data notices). VS Code's Settings editor and `settings.json` work as well.

## Asking about a line

Right-click a line and choose **LogicLens: Ask About This Line** (or press `Ctrl+Alt+E Q`). Once LogicLens has run in a window, the comment "+" in the gutter also starts a question. If another extension also adds comments (for example GitHub Pull Requests), clicking "+" first asks which one to use; pick LogicLens.

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
