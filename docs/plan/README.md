# LogicLens: Execution Plan

**Date:** 2026-11-01
**Approach:** thin vertical slices (ADR-0015)

Each slice is a small, demoable increment: a user can do something new, end to end, in a real VS Code window. A slice includes its UI, pipeline, provider, guard, tests, and doc updates. It is never a horizontal layer. Every slice keeps all earlier flows working.

`plan S<N>` in code comments and ADRs points at `NN-*.md` here.

## Slices

| Slice | File | User can… | Depends on | Status |
|---|---|---|---|---|
| S0 | [00-preflight-and-spike.md](00-preflight-and-spike.md) | (no user value) repo, CI, and feasibility answers for Copilot Free and Claude Code | – | Done |
| S1 | [01-explain-file-tracer.md](01-explain-file-tracer.md) | run "Explain File" and read a streamed explanation from Copilot Free models inline over the code | S0 | In progress |
| S2 | [02-step-walkthrough.md](02-step-walkthrough.md) | step through the explanation with editor highlighting and keys | S1 | In progress |
| S3 | [03-more-targets-and-controls.md](03-more-targets-and-controls.md) | explain a selection, a symbol, or a file from the Explorer; change depth, audience (including ELI5), and jargon | S2 | In progress |
| S4 | [04-ask-at-any-line.md](04-ask-at-any-line.md) | ask a question at any line and get an inline answer with follow-ups | S2 | In progress |
| S5 | [05-provider-choice.md](05-provider-choice.md) | see and switch provider and model from the status bar; get a setup view when nothing is ready | S1 | In progress |
| S6 | [06-claude-code.md](06-claude-code.md) | use Claude Code as the provider | S5 | In progress |
| S7 | [07-more-providers.md](07-more-providers.md) | use Codex CLI, Gemini CLI, Kiro, an Anthropic or OpenAI key, or local Ollama; run in VS Code forks (after release) | S6, S12 | Not started |
| S8 | [08-cache-and-staleness.md](08-cache-and-staleness.md) | reopen a file and see the saved walkthrough, with changed steps marked | S2, S4 | In progress |
| S9 | [09-polish-and-publish.md](09-polish-and-publish.md) | install LogicLens on Linux from the VS Code Marketplace | S1–S6, S8, S10, S11 | Not started |
| S10 | [10-follow-across-files.md](10-follow-across-files.md) | follow definitions across files and return via breadcrumbs | S3 | In progress |
| S11 | [11-bookmarks.md](11-bookmarks.md) | bookmark steps, answers, and code and come back to them later | S4, S8 | Not started |
| S12 | [12-personality-packs.md](12-personality-packs.md) | pick one of five explainer voices (after first release) | S9 | Not started |
| S13 | [13-windows-and-macos.md](13-windows-and-macos.md) | install and use LogicLens on Windows and macOS (after release) | S9 | Not started |

Status values: Not started, In progress, Done (exit check ticked), Blocked (reason in slice file).

## Sequence

```
S0 ─► S1 ─► S2 ─┬─► S3 ─────► S10 ───────┐
                ├─► S4 ─────────┐         │
          S1 ─► S5 ─► S6        │         │
                         S2+S4 ─► S8 ─► S11├─► S9 ─► S12 ─► S7
                                            └─► S13
```

- S3, S4, and S5 can run in parallel after S2 (S5 only needs S1).
- MVP providers are Copilot Free through `vscode.lm` and Claude Code (ADR-0025). S6 is provider-only and can start as soon as S5 is done, independent of S3 and S4.
- S7 (all other providers and fork checks) runs after S12, the last slice of the original plan.
- The MVP targets VS Code stable on Linux only (ADR-0026). Every demo script and exit check before S13 means Linux. S13 (Windows and macOS) runs after release, independent of S7.
- S10 and S11 are numbered after S9 because they were added later; they still ship before S9. S7 is numbered early but ships last. S12 is the first post-release slice.
- Recommended solo order: S0, S1, S2, S4, S5, S6, S3, S8, S10, S11, S9, S12, S7. That reaches the two headline features (walkthrough, ask at line) with both MVP providers (Copilot Free, Claude Code) early.

## Why these slices are thin

- S1 is a tracer bullet: one command, one provider, plain Markdown, one inline thread. It proves the riskiest path (extension host to `vscode.lm` to the editor, with the privacy gate) before anything else.
- Structure (S2) comes before breadth (S3) so the core experience is right before more entry points multiply it.
- Provider work is split so each slice adds a distinct integration pattern: in-editor API (S1), picker and registry (S5), CLI subprocess (S6), and after release HTTP and the remaining CLIs (S7).
- Privacy guard parts land with the first slice that needs them, never later: notice, trust, exclusions, and secret scan (withhold or refuse, ADR-0020) in S1; per-provider notice in S5; CLI isolation in S6; secret storage in S7 (after release, when the first API-key provider arrives).

## Every slice's definition of done

1. The slice's demo script runs in an Extension Development Host.
2. Unit and integration tests for the slice pass in CI.
3. Spec, architecture, and ADR changes made in the same change.
4. `SECURITY.md` pre-merge checklist holds.
5. `CHANGELOG.md` entry; slice status updated here and in the slice file.
