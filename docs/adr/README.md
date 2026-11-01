# Decision Log

Architecture Decision Records (ADRs) for LogicLens. One file per record: the context that forced it, what was chosen, what was rejected, and what follows from it.

Related: [../spec/README.md](../spec/README.md) (what the product does), [../architecture/README.md](../architecture/README.md) (how it is built), [../plan/README.md](../plan/README.md) (order of work), [../../SECURITY.md](../../SECURITY.md) (security rules).

## How to use this log

- **Find records by tag.** Read this index, then open only the ADRs whose tags or summaries match your task. Skip Superseded records unless tracing history.
- **Add a record** for any decision that is hard to reverse, crosses modules, adds or replaces a major dependency or AI provider, changes what code leaves the machine, or resolves an open item. Copy the template into `NNNN-short-slug.md` and add a row below in the same change.
- **Number sequentially.** Never reuse a number.
- **Do not rewrite history.** Once Accepted, do not edit the Decision. Add a new record and mark the old one `Superseded by ADR-NNNN` in its file and here.
- **Status values:** `Accepted` (code must follow it), `Proposed` (recommended, confirm in the named slice), `Open` (options listed, no choice yet), `Superseded by ADR-NNNN`, `Deprecated`.
- **Tags:** product, scope, process, docs, stack, build, release, providers, cli, http, protocol, prompts, ui, comments, webview, state, cache, privacy, security, telemetry. Add a new tag only when none fit.

### Template

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Open | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD
- **Deciders:** names or roles
- **Source:** spec §N / arch §N / plan S<N> / discussion link

## Context
What problem or constraint forces a decision. Facts, not opinions.

## Decision
What we will do, stated plainly.

## Alternatives considered
- Option: why it was rejected.

## Consequences
What follows, good and bad.
```

## Index

| ADR | Title | Status | Tags |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | process, docs |
| [0002](0002-explain-only-product-boundary.md) | Explain only; never edit or run code | Accepted | product, scope, security |
| [0003](0003-bring-your-own-ai-no-backend.md) | Bring your own AI; no LogicLens backend | Accepted | product, providers, privacy |
| [0004](0004-vscode-language-model-api-as-primary-provider.md) | VS Code Language Model API as the primary provider | Accepted | providers |
| [0005](0005-provider-clis-in-headless-isolated-mode.md) | Provider CLIs headless, tools disabled, isolated directory | Proposed (Claude Code verified; others in S7) | providers, cli, security |
| [0006](0006-direct-http-adapters-with-secret-storage.md) | Direct HTTP adapters with keys in SecretStorage | Accepted | providers, http, security |
| [0007](0007-line-tagged-streaming-protocol.md) | Line-tagged text protocol for walkthrough output | Accepted | protocol, prompts |
| [0008](0008-comments-api-for-line-questions.md) | Comments API for line questions | Accepted | ui, comments |
| [0009](0009-svelte-webview-view-panel.md) | Single webview view panel built with Svelte 5 | Superseded by ADR-0028 | ui, webview, stack |
| [0010](0010-absolute-line-numbers-in-prompts.md) | Absolute line numbers in prompts | Accepted | prompts, protocol |
| [0011](0011-typescript-esbuild-pnpm-toolchain.md) | TypeScript, esbuild, Vite, pnpm, vitest, test-cli | Accepted | stack, build |
| [0012](0012-publish-to-marketplace-and-open-vsx.md) | Publish to Marketplace and Open VSX | Superseded by ADR-0026 | release |
| [0013](0013-no-telemetry-in-mvp.md) | No telemetry in the MVP | Accepted | telemetry, privacy |
| [0014](0014-explicit-action-gate-and-data-notice.md) | Single request gate; explicit action, data notice, no silent fallback | Accepted | privacy, security, providers |
| [0015](0015-thin-vertical-slices.md) | Deliver in thin vertical slices | Accepted | process |
| [0016](0016-kiro-integration-path.md) | Kiro integration path | Open (S7, deferred by ADR-0025) | providers |
| [0017](0017-minimum-vscode-engine-version.md) | Minimum VS Code engine version | Accepted (`^1.90.0`) | stack, release |
| [0018](0018-product-name-and-publisher.md) | Product name and publisher ID: LogicLens | Accepted (name); publisher ID before S9 | product, release |
| [0019](0019-local-cache-with-text-reanchoring.md) | Local cache with text-based re-anchoring | Accepted | cache, state, privacy |
| [0020](0020-deterministic-secret-scan-withhold-or-refuse.md) | Deterministic local secret scan; withhold lines or refuse, never send | Accepted | security, privacy |
| [0021](0021-navigation-trail-via-explicit-follow.md) | Navigation trail built from an explicit Follow command | Accepted | ui, state |
| [0022](0022-bookmarks-store-separate-from-cache.md) | Bookmarks in extension storage, separate from the cache | Accepted | state, ui, privacy |
| [0023](0023-bundled-tone-only-personality-packs.md) | Bundled, tone-only personality packs | Proposed (S12) | prompts, product |
| [0024](0024-terms-of-use-acceptance-gate.md) | Terms of use accepted before the first request | Accepted | product, privacy, security |
| [0025](0025-mvp-providers-copilot-free-and-claude-code.md) | MVP providers: Copilot Free through `vscode.lm`, and Claude Code | Accepted | providers, scope |
| [0026](0026-mvp-targets-vscode-on-linux.md) | MVP targets VS Code on Linux only; Marketplace only | Accepted | scope, release |
| [0028](0028-inline-explanations-in-the-editor.md) | Explanations inline in the editor; no side panel | Accepted (step placement amended by ADR-0029) | ui, comments, product |
| [0029](0029-step-threads-above-their-code.md) | Step threads sit just above their code | Accepted | ui, comments |
| [0030](0030-lazy-activation-for-the-gutter-plus.md) | Keep lazy activation; the gutter "+" appears after first use | Accepted | ui, comments, stack |
