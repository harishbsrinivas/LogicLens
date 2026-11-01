# LogicLens: Product Specification

**Status:** Proposed MVP specification
**Date:** 2026-11-01
**Product:** VS Code extension. The MVP supports VS Code stable on Linux only (ADR-0026); Windows and macOS (S13) and VS Code–compatible editors through Open VSX (S7) come after release
**Primary audience:** Developers reading code they did not write: new team members, reviewers, maintainers of legacy code, and learners

Source of truth for what the product does. Each section lives in its own file; the file number is the section number, so `spec §N` in code comments and ADRs points at `NN-*.md`. Read this index, then open only the sections your task touches. How it is built: [../architecture/README.md](../architecture/README.md). Why: [../adr/README.md](../adr/README.md). Order of work: [../plan/README.md](../plan/README.md).

## Sections

| § | File | Covers | Read when touching |
|---|---|---|---|
| 1 | [01-product-vision.md](01-product-vision.md) | Purpose, positioning, product boundary, principles | Scope or positioning questions |
| 2 | [02-users-and-core-journeys.md](02-users-and-core-journeys.md) | Personas and the journeys the MVP must support | Any new user-facing flow |
| 3 | [03-entry-points-and-targets.md](03-entry-points-and-targets.md) | How a user starts an explanation, and what can be explained | Commands, menus, CodeLens, Explorer integration |
| 4 | [04-step-by-step-walkthrough.md](04-step-by-step-walkthrough.md) | Walkthrough structure, navigation, editor highlighting, depth, audience (technical level), jargon | Inline walkthrough threads, decorations, explanation schema, prompt variants |
| 5 | [05-ask-at-any-line.md](05-ask-at-any-line.md) | Line questions, threads, follow-ups | Comment threads, question input, conversation context |
| 6 | [06-ai-provider-integration.md](06-ai-provider-integration.md) | Which AI tools we use, detection, selection, fallback | Provider adapters, provider picker, model settings |
| 7 | [07-interface-and-visual-design.md](07-interface-and-visual-design.md) | Inline surfaces and layout, visual language, accessibility | Comment threads, CodeLens, theming, any visual change |
| 8 | [08-privacy-trust-and-consent.md](08-privacy-trust-and-consent.md) | Terms of use acceptance, what is sent, consent, exclusions, hardcoded-secret detection, workspace trust | Anything that reads files or sends a request |
| 9 | [09-commands-settings-and-keybindings.md](09-commands-settings-and-keybindings.md) | Contributed commands, settings, default keys | `package.json` contributions |
| 10 | [10-explanation-quality.md](10-explanation-quality.md) | What a good explanation is, failure handling, caching and staleness | Prompts, schema validation, cache |
| 11 | [11-scope-and-exclusions.md](11-scope-and-exclusions.md) | MVP scope, explicit non-goals, post-MVP candidates | Planning, feature requests |
| 12 | [12-success-measures-and-mvp-exit.md](12-success-measures-and-mvp-exit.md) | Quality checks, success measures, exit criteria | Release readiness |
| 13 | [13-following-code-across-files.md](13-following-code-across-files.md) | Follow to definition, navigation trail, breadcrumbs, back and forward | Cross-file navigation, trail CodeLens |
| 14 | [14-bookmarks.md](14-bookmarks.md) | Bookmarking steps, answers, and code; Bookmarks view; re-anchoring | Bookmarks, tree views, saved explanations |
| 15 | [15-personality-packs.md](15-personality-packs.md) | Five explainer voices, rules they follow, picker, evaluation | Prompt tone, personality setting (S12) |
| 16 | [16-settings-page.md](16-settings-page.md) | The LogicLens settings page: sections, editing rules, safety | Settings page, any new setting (S14) |

## Editing rules

- Change only the affected section file. Keep section numbers stable; append new sections as `17-*.md` and add a row above.
- If a section passes about 300 lines, split it and update this index.
- If a change contradicts the spec, update the spec in the same change.
