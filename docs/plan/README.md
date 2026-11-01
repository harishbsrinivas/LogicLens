# Clarity: Execution Plan

**Date:** 2026-11-01
**Approach:** thin vertical slices (ADR-0015)

Each slice is a small, demoable increment: a user can do something new, end to end, in a real VS Code window. A slice includes its UI, pipeline, provider, guard, tests, and doc updates. It is never a horizontal layer. Every slice keeps all earlier flows working.

`plan S<N>` in code comments and ADRs points at `NN-*.md` here.

## Slices

| Slice | File | User can… | Depends on | Status |
|---|---|---|---|---|
| S0 | [00-preflight-and-spike.md](00-preflight-and-spike.md) | (no user value) repo, CI, and provider feasibility answers | – | In progress |
| S1 | [01-explain-file-tracer.md](01-explain-file-tracer.md) | run "Explain File" and read a streamed explanation from Copilot models in the panel | S0 | Not started |
| S2 | [02-step-walkthrough.md](02-step-walkthrough.md) | step through the explanation with editor highlighting and keys | S1 | Not started |
| S3 | [03-more-targets-and-controls.md](03-more-targets-and-controls.md) | explain a selection, a symbol, or a file from the Explorer; change depth and audience | S2 | Not started |
| S4 | [04-ask-at-any-line.md](04-ask-at-any-line.md) | ask a question at any line and get an inline answer with follow-ups | S2 | Not started |
| S5 | [05-provider-choice.md](05-provider-choice.md) | see and switch provider and model from the status bar; get a setup view when nothing is ready | S1 | Not started |
| S6 | [06-claude-code-and-codex.md](06-claude-code-and-codex.md) | use Claude Code or Codex CLI as the provider | S5 | Not started |
| S7 | [07-more-providers.md](07-more-providers.md) | use Gemini CLI, Kiro, an Anthropic or OpenAI key, or local Ollama | S6 | Not started |
| S8 | [08-cache-and-staleness.md](08-cache-and-staleness.md) | reopen a file and see the saved walkthrough, with changed steps marked | S2, S4 | Not started |
| S9 | [09-polish-and-publish.md](09-polish-and-publish.md) | install Clarity from the Marketplace or Open VSX | all above | Not started |

Status values: Not started, In progress, Done (exit check ticked), Blocked (reason in slice file).

## Sequence

```
S0 ─► S1 ─► S2 ─┬─► S3 ─────────────┐
                ├─► S4 ─────────┐   │
          S1 ─► S5 ─► S6 ─► S7  │   │
                         S2+S4 ─► S8 ├─► S9
```

- S3, S4, and S5 can run in parallel after S2 (S5 only needs S1).
- S6 and S7 are provider-only slices; they can start as soon as S5 is done, independent of S3 and S4.
- Recommended solo order: S0, S1, S2, S4, S5, S6, S3, S8, S7, S9. That reaches the two headline features (walkthrough, ask at line) with the two most requested providers (Copilot models, Claude Code) early.

## Why these slices are thin

- S1 is a tracer bullet: one command, one provider, plain Markdown, minimal panel. It proves the riskiest path (extension host to `vscode.lm` to webview, with the privacy gate) before anything else.
- Structure (S2) comes before breadth (S3) so the core experience is right before more entry points multiply it.
- Provider work is split so each slice adds a distinct integration pattern: in-editor API (S1), picker and registry (S5), CLI subprocess (S6), HTTP and the remaining CLIs (S7).
- Privacy guard parts land with the first slice that needs them, never later: notice, trust, exclusions, and secret scan in S1; per-provider notice in S5; CLI isolation in S6; secret storage in S7.

## Every slice's definition of done

1. The slice's demo script runs in an Extension Development Host.
2. Unit and integration tests for the slice pass in CI.
3. Spec, architecture, and ADR changes made in the same change.
4. `SECURITY.md` pre-merge checklist holds.
5. `CHANGELOG.md` entry; slice status updated here and in the slice file.
