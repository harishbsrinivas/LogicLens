# Development

How to set up, build, and contribute to LogicLens. Applies to humans and AI agents alike. [AGENTS.md](AGENTS.md) holds the mandatory agent rules, [SECURITY.md](SECURITY.md) the security rules, and [docs/plan/](docs/plan/README.md) the order of work. If this file and one of those disagree, those win; fix this file in the same change.

## 1. Setup

Requirements:

- Node 22.12 or later (`engine-strict` is on, so older Node fails install).
- pnpm, at the version pinned in `package.json` `packageManager`. Enable it with `corepack enable`. Never use npm or yarn, and never commit their lockfiles.
- Linux. The MVP supports VS Code stable on Linux only (ADR-0026); Windows and macOS arrive in S13.
- VS Code 1.90 or later. The integration tests download VS Code 1.90.0, the minimum engine (ADR-0017).
- [gitleaks](https://github.com/gitleaks/gitleaks) on `PATH` for the pre-push secret scan.
- For manual testing: GitHub Copilot signed in (the Free plan is enough). Claude Code from S6 on.

```sh
corepack enable
pnpm install
pnpm build
```

Press F5 in VS Code ("Run Extension"). The default build task runs `pnpm watch`, so the host rebuilds on save. Reload the Extension Development Host window (Ctrl+R) to pick up changes.

## 2. Branches: one per slice

Work is delivered in thin vertical slices (ADR-0015). Each slice gets its own branch, and the branch merges to `main` only when the slice is done.

### Naming

| Kind | Branch | Example |
|---|---|---|
| Slice | `s<N>-<slug>`, slug taken from the slice file name | `s2-step-walkthrough` for `docs/plan/02-step-walkthrough.md` |
| Bug fix outside a slice | `fix/<short-slug>` | `fix/thread-stop-action` |
| Docs only | `docs/<short-slug>` | `docs/adr-0026-cache-format` |
| Tooling, deps, CI | `chore/<short-slug>` | `chore/bump-vite` |

Lowercase, hyphens, no issue numbers or personal names. One slice per branch; never mix two slices on one branch.

### Life of a slice branch

1. Check the slice's dependencies in [docs/plan/README.md](docs/plan/README.md). Every slice it depends on must be Done, or at least have its own open branch (see stacking below).
2. Branch from an up-to-date `main`:
   ```sh
   git switch main && git pull
   git switch -c s2-step-walkthrough
   ```
3. In the first commit, set the slice's **Status** to `In progress` in its slice file and in the plan index table.
4. Work through the slice's task list, ticking boxes as tasks land. Commit small and often. Push the branch early so CI runs on it.
5. Open a draft pull request to `main` as soon as there is something to look at. Title: `S2: Step walkthrough`.
6. When the demo script passes in an Extension Development Host and every exit check box is ticked, set the status to `Done`, add the `CHANGELOG.md` entry, and mark the pull request ready.
7. Merge with a merge commit (not squash; see stacking), then delete the branch.

### Stacked slices

When a slice depends on one that is not merged yet (as S1 depends on S0 today), branch from the predecessor's branch instead of `main`:

```sh
git switch s1-explain-file
git switch -c s2-step-walkthrough
```

- Keep it current by merging the predecessor into it: `git merge s1-explain-file`. Do not rebase a branch that is pushed; merging is what this repo already does and it keeps stacked branches intact.
- Point its pull request at the predecessor branch while that is open. Retarget it to `main` once the predecessor merges.
- Merge in dependency order. Never merge a stacked slice before its predecessor.
- Squash merges break stacks (the stacked branch still holds the original commits), which is why slices merge with a merge commit.

Slices that the plan marks as parallel (for example S3, S4, and S5 after S2) each branch from `main` or from their common predecessor, never from each other.

### Keeping in sync with `main`

Merge `main` into a long-running slice branch whenever `main` moves (`git merge origin/main`), and always before marking the pull request ready. Resolve conflicts on the slice branch, not on `main`.

### `main` is protected

- No direct pushes. Everything goes through a pull request with green CI.
- `main` must always build, pass tests, and package. Every earlier slice's flow keeps working.
- Hotfixes go on a `fix/` branch from `main`, then get merged into any open slice branches that need them.

## 3. Commits

- Prefix the subject with the slice: `S2: highlight active step range`. Use `S2 (WIP):` for a commit that leaves the slice knowingly incomplete. Non-slice branches use `fix:`, `docs:`, or `chore:`.
- Imperative mood, about 72 characters or fewer, no trailing period. A body explains why, not what.
- One logical change per commit. Formatting-only changes get their own commit.
- Code, its tests, and its doc updates go in the same commit or the same pull request, never "docs later".
- Never commit secrets, `.vsix` files, `dist/`, `out/`, or `.vscode-test/`.

## 4. Pull requests

A pull request is one slice or one fix. Its description includes:

- The slice and which tasks it completes.
- The demo script result (which OS, which provider).
- A line per new runtime dependency explaining why it is needed (SECURITY.md §3).
- Any new or changed ADR, spec section, or architecture section.

Before marking it ready, run locally what CI runs:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:integration        # on headless Linux: xvfb-run -a pnpm test:integration
pnpm audit --audit-level=high
pnpm outdated
gitleaks detect --no-banner
pnpm package
```

Then walk the SECURITY.md pre-merge checklist and the definition of done in AGENTS.md §5. CI (`.github/workflows/ci.yml`) repeats all of this and uploads the VSIX as an artifact.

## 5. Coding practices

### TypeScript

- `strict` is on; keep it. No `any`: use `unknown` and narrow. No non-null assertions (`!`) to silence the compiler; handle the case.
- Prefer `type` imports for types (`import type { … }`).
- Named exports only; no default exports.
- `async`/`await` over raw promise chains. Never leave a promise floating: await it, return it, or pass it to an error handler.
- Errors that reach the user carry a clear message and a next step (a settings link, a retry). Never put code, prompts, model output, or keys in an error message.

### Structure (arch §3)

- `src/extension.ts` wires modules and does nothing else.
- `commands/` resolve arguments and call services. No logic.
- Only `explain/` calls providers, and only through `guard/RequestGate.send()`.
- `providers/` know nothing about steps, walkthroughs, or UI.
- New module, command, view, or setting: update arch §3 and spec §9 in the same change.

### Keep `vscode` at the edges

Logic modules take small interfaces, not the `vscode` API, so they run under vitest without an editor. The guard is the model: `guard/prompter.ts` defines `Prompter` and `KeyValueStore`; `guard/vscodePrompter.ts` implements them with `vscode`; tests pass fakes from `test/unit/helpers.ts`. Follow the same split for new modules: put the `vscode` adapter in its own file and keep it thin.

### VS Code extension practices

- Push every `Disposable` (commands, listeners, decorations, providers, output channels) into `context.subscriptions` or a disposable owned by something that is.
- Activation stays lazy: contributed commands and views only. No `*` or `onStartupFinished`.
- Thread a `CancellationToken` from the command through the provider to the request or child process. Stop must actually stop.
- Never block the extension host: no synchronous `fs` calls, no long loops on the main thread. Read files through `vscode.workspace.fs` or open documents.
- Read settings through one module (`guard/settings.ts` pattern), with defaults matching `package.json` `contributes.configuration`.
- Respect Workspace Trust and the theme. No hard-coded colours; use theme colors (`ThemeColor`) for decorations so light, dark, and high contrast all work.
- Log through `util/log.ts` only. Prompts, code, and responses are logged only when `logiclens.debug.logPrompts` is on.

### Inline UI (ADR-0028)

- No webview for explanations. Explanations are comment threads from `ui/inlineThreads.ts`; step titles and breadcrumbs are CodeLens. The settings page (`ui/settingsPanel.ts`, ADR-0031) is the only webview; a new setting goes in `package.json` and `src/settings/schema.ts`.
- Model output goes through `ui/safeMarkdown.ts` into a `MarkdownString` with `isTrusted`, `supportHtml`, and `supportThemeIcons` off (SECURITY.md §4).
- `ui/` renders state from `state/`; thread actions call commands, which resolve their document from the thread.

### Provider CLIs (S6 on)

`child_process.spawn(binary, args, { shell: false })`, fixed flags in `args`, user code and prompts on stdin, a timeout, an output cap, and process-tree kill on cancel. Binary paths come only from `machine` or `application` scope settings or `PATH` (SECURITY.md §5).

## 6. Tests

| Layer | Tool | Lives in | Covers |
|---|---|---|---|
| Unit | vitest | `test/unit/` | Pure logic: guard, protocol parser, context builder, prompts, validators, adapters against fakes |
| Integration | `@vscode/test-cli` | `test/integration/` | Commands, inline threads, decorations, gate refusals, no implicit send, against a `FakeProvider` |
| Evaluation | `pnpm eval` (local only) | `test/eval/` | Explanation quality with real providers (spec §10) |

- Every task in a slice ships with its tests. A bug fix starts with a failing test that reproduces it.
- CI never calls a real AI provider. Use `FakeProvider` and recorded fixtures.
- Each privacy rule has a test that proves nothing is sent when it should not be.
- Secret-shaped fixtures are assembled at runtime with `fake(...)` from `test/unit/helpers.ts` so gitleaks does not flag them. Never commit a whole fake key.
- Name tests after behaviour: `refuses an excluded file without sending`, not `test1`.

## 7. Dependencies

- Prefer the VS Code API and the Node standard library. Each runtime dependency ships to every user.
- Before adding one: check it is maintained, widely used, spelled correctly (typosquats exist), and license compatible. Write the reason in the pull request.
- Major dependency or framework changes need an ADR.
- Install scripts are allowed only for esbuild (`pnpm-workspace.yaml` `allowBuilds`). Do not widen that list without a reason in the pull request.
- Transitive fixes go in `pnpm-workspace.yaml` `overrides`, each with its advisory ID in a comment.
- Dependency bumps go on a `chore/` branch, not inside a slice, unless the slice needs the new version.

## 8. Docs in the same change

The docs are part of the code. A pull request that changes behaviour without its docs is not done (AGENTS.md):

- Behaviour change: the matching `docs/spec/` section.
- Module, command, view, setting, schema, integration, or build change: the matching `docs/architecture/` section.
- Hard-to-reverse or cross-module decision: a new ADR plus its index row.
- Slice progress: the slice file's tasks and Status, and the plan index table.
- User-visible change: `CHANGELOG.md` under `Unreleased`.

Keep each doc file under about 300 lines and every index row matching its file.

## 9. Releases

Releases start with S9. A release is a `v*` tag on `main` (semantic versioning; pre-1.0 versions may use the Marketplace pre-release channel). CI runs the full check, then publishes the Linux VSIXs to the VS Code Marketplace with environment-protected secrets and attaches them to a GitHub release (arch §9, ADR-0026). Open VSX publishing starts in S7. Move `Unreleased` in `CHANGELOG.md` to the new version in the same pull request that bumps `package.json`.
