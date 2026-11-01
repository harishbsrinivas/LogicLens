# LogicLens: Architecture

**Status:** Proposed; S0 skeleton and S1 explain-file tracer implemented
**Date:** 2026-11-01
**Companion to:** [../spec/README.md](../spec/README.md)

How the product in the specification is built. The specification is authoritative for behavior, privacy, and release criteria; if the two disagree, the specification wins and this document should be corrected. Items marked **(proposed)** are decisions the spec does not make; each maps to a Proposed or Open ADR and is confirmed in the S0 spike or the named slice.

Each section lives in its own file; `arch §N` points at `NN-*.md`.

## Sections

| § | File | Covers | Read when touching |
|---|---|---|---|
| 1 | [01-architectural-drivers.md](01-architectural-drivers.md) | Spec constraints and their consequences | Any major change |
| 2 | [02-system-context.md](02-system-context.md) | Context diagram, external systems | New integrations |
| 3 | [03-extension-structure.md](03-extension-structure.md) | Folder layout, modules, activation, dependency rules | `src/`, `package.json` contributions |
| 4 | [04-provider-layer.md](04-provider-layer.md) | Provider interface, each adapter, detection, spike checklist | `src/providers/` |
| 5 | [05-explanation-pipeline.md](05-explanation-pipeline.md) | Context building, prompts, streaming protocol, parsing, anchoring | `src/explain/`, `src/prompts/` |
| 6 | [06-ui-architecture.md](06-ui-architecture.md) | Inline explanation threads, CodeLens rows, decorations, question threads, trail breadcrumbs, bookmarks view, status bar | `src/ui/` |
| 7 | [07-state-and-storage.md](07-state-and-storage.md) | Session state, cache, range tracking, bookmarks store, trail state, secrets | `src/state/`, `src/cache/`, `src/bookmarks/`, `src/nav/` |
| 8 | [08-security-controls.md](08-security-controls.md) | Control per risk | `src/guard/`, rendering model output, CLI spawning, `SECURITY.md` |
| 9 | [09-build-test-release.md](09-build-test-release.md) | Toolchain, tests, CI, packaging, publishing | `package.json`, `esbuild.mjs`, `.github/`, `test/` |
| 10 | [10-open-decisions.md](10-open-decisions.md) | Open architecture items | Resolving a decision (also add an ADR) |

## Editing rules

- Change only the affected section file. Keep section numbers stable; append new sections as `11-*.md` and add a row above.
- Keep it accurate rather than long. Delete text that no longer matches the code.
- If a section passes about 300 lines, split it and update this index.
