# Changelog

## Unreleased

- S2: **LogicLens: Explain File** now produces a step-by-step walkthrough. The overview and summary sit at the top of the file; each step's explanation sits just above the code it explains, with a title row (number, title, lines, Previous, Next). Alt+] and Alt+[ move between steps, which highlights the step, dims the rest, shows its number in the gutter, and opens its explanation; Escape clears the highlight. **Show All Steps** expands every step. A response that ends early offers **Continue**. New settings `logiclens.focusDimming` and `logiclens.followCursor`. `pnpm eval` measures recorded responses against a 10-file seed corpus.
- Scope: the MVP targets VS Code stable on Linux only and publishes to the VS Code Marketplace only (ADR-0026, supersedes ADR-0012). Windows and macOS move to new slice S13; Open VSX and VS Code forks to S7.
- S1: **LogicLens: Explain File** streams a plain-Markdown explanation of the active file from VS Code language models (for example GitHub Copilot) inline in the editor, as a block at the top of the file over the code (ADR-0028), with Stop, Explain again, and **LogicLens: Close Explanation** in its title, a provider and model header, and **LogicLens: View Terms of Use**. There is no side panel; model output is rendered by VS Code with HTML and command links off and images shown as links.
- S1: every request goes through the request gate: terms of use, workspace trust, `logiclens.exclude` plus `.logiclensignore`, size limit, one-time data notice, and a local secret scan that withholds flagged lines (lock icon in the gutter, notice in the explanation) or refuses under `logiclens.secrets.action: refuse-file`.
- S1: removed the S0 placeholder `LogicLens: Hello` command.
- S1: with Copilot, LogicLens now defaults to Copilot's chat model with the largest input window instead of the first model VS Code lists (which can be an agent-backed model).
- S0: feasibility spike complete for Copilot Free and Claude Code; the line-tagged protocol (ADR-0007) and the `^1.90.0` engine floor (ADR-0017) are accepted.
- Renamed the product from Clarity to LogicLens; identifiers now use the `logiclens.` prefix (ADR-0018).
- Added `TERMS.md` and the terms-of-use acceptance gate to the spec and plan (ADR-0024); the gate ships in S1.
- S0: repository skeleton, build, tests, CI, and a placeholder `LogicLens: Hello` command.
- Narrowed MVP providers to GitHub Copilot Free (through `vscode.lm`) and Claude Code; Codex, Gemini CLI, Kiro, API keys, Ollama, and fork checks moved to S7, after S12 (ADR-0025).
