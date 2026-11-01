# 11. Scope and Exclusions

## MVP scope

The MVP is complete when slices S1 to S9 in [../plan/README.md](../plan/README.md) pass their exit checks. In summary:

- Explain a file, a selection, or a symbol, from the editor, the Explorer, the command palette, or CodeLens (spec §3).
- Step-by-step walkthrough with editor highlighting, navigation, depth, and audience (spec §4).
- Ask questions at any line in inline threads with follow-ups (spec §5).
- Providers: VS Code Language Models, Claude Code CLI, Codex CLI, Gemini CLI, Anthropic API, OpenAI API, Ollama, and Kiro if the S0 spike finds a supported path (spec §6).
- Data notice, exclusions, secret scan, workspace trust (spec §8).
- Local cache with staleness tracking (spec §10).
- Published to the VS Code Marketplace and Open VSX (arch §9).

## Explicit non-goals

- **Writing or changing code.** No code generation, refactoring, quick fixes, or "apply" buttons.
- **Running code.** No execution, debugging, or test running.
- **A Clarity backend or account.** No server, no login, no sync, no billing.
- **Bundling a model.** Clarity never ships model weights or its own API key.
- **Telemetry.** None in the MVP.
- **Team features.** No sharing, comments for others, or shared caches.
- **Replacing chat.** Clarity is not a general chat window. Threads are about specific lines.

## Post-MVP candidates

Ranked roughly by expected value. Each needs a spec update and, where it changes what is sent, an ADR.

1. **Cross-file context:** include definitions of imported symbols (via the definition provider), off by default, shown in the data notice.
2. **Folder and project overview:** explain the structure of a folder from the Explorer.
3. **Explain a diff:** walk through a git change or the current pull request.
4. **Chat participant:** an `@clarity` participant in VS Code chat that reuses the same walkthrough engine.
5. **Export:** save a walkthrough as Markdown next to the file or as a code tour.
6. **Notebook support.**
7. **Glossary view:** concepts collected across walkthroughs in a workspace.
8. **Opt-in telemetry** respecting VS Code's telemetry setting, with an ADR.
