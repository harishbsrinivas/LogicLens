# 11. Scope and Exclusions

## MVP scope

The MVP is complete when slices S1 to S11 in [../plan/README.md](../plan/README.md) pass their exit checks (S9, publishing, runs last). In summary:

- Explain a file, a selection, or a symbol, from the editor, the Explorer, the command palette, or CodeLens (spec §3).
- Step-by-step walkthrough with editor highlighting, navigation, depth, audience (including `eli5`), and jargon level (spec §4).
- Ask questions at any line in inline threads with follow-ups (spec §5).
- Providers: VS Code Language Models, Claude Code CLI, Codex CLI, Gemini CLI, Anthropic API, OpenAI API, Ollama, and Kiro if the S0 spike finds a supported path (spec §6).
- Data notice, exclusions, deterministic secret scan that withholds lines or refuses the file, workspace trust (spec §8).
- Local cache with staleness tracking (spec §10).
- Follow definitions across files with a breadcrumb trail (spec §13).
- Bookmarks for steps, answers, and code (spec §14).
- Published to the VS Code Marketplace and Open VSX (arch §9).

## After the MVP release

Planned as the next slice after publishing (S12): five personality packs for the explainer's voice (spec §15).

## Explicit non-goals

- **Writing or changing code.** No code generation, refactoring, quick fixes, or "apply" buttons.
- **Running code.** No execution, debugging, or test running.
- **A LogicLens backend or account.** No server, no login, no sync, no billing.
- **Bundling a model.** LogicLens never ships model weights or its own API key.
- **Telemetry.** None in the MVP.
- **Team features.** No sharing, comments for others, or shared caches.
- **Replacing chat.** LogicLens is not a general chat window. Threads are about specific lines.

## Post-MVP candidates

Ranked roughly by expected value. Each needs a spec update and, where it changes what is sent, an ADR.

1. **Cross-file context:** include definitions of imported symbols (via the definition provider), off by default, shown in the data notice.
2. **Folder and project overview:** explain the structure of a folder from the Explorer.
3. **Explain a diff:** walk through a git change or the current pull request.
4. **Chat participant:** an `@logiclens` participant in VS Code chat that reuses the same walkthrough engine.
5. **Export:** save a walkthrough or the bookmarks as Markdown next to the file or as a code tour.
6. **Notebook support.**
7. **Glossary view:** concepts collected across walkthroughs in a workspace.
8. **Opt-in telemetry** respecting VS Code's telemetry setting, with an ADR.
9. **Custom personality packs:** user-written voice instructions. Needs an ADR, since user text becomes part of the system prompt.
10. **Record native Go to Definition in the trail,** if VS Code adds an event that identifies definition navigation (spec §13).
11. **Classification-marker warning:** detect markings such as "Confidential" or "Eyes Only" in a file header and refuse or warn before sending, as a safety net for the terms of use (spec §8, ADR-0024).
