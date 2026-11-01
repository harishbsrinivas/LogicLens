# S0. Preflight and Feasibility Spike

**Status:** In progress. Skeleton done and CI green on PR #1; spike: Claude Code verified, `vscode.lm` with Copilot Free not yet run.
**Goal:** a working skeleton that builds, tests, and packages, plus answers to the integration questions the rest of the plan depends on. Not a user release.

## Tasks

### Repository skeleton
- [x] `git init`; `.gitignore` (node_modules, dist, `*.vsix`, `.vscode-test`, `.env*`), `.gitleaks.toml`, `.npmrc`, `pnpm-workspace.yaml`.
- [x] `package.json` manifest with name, publisher placeholder, engine placeholder, one command `logiclens.hello` that shows a notification.
- [x] esbuild bundle for the host; Vite for an empty webview; `shared/` types folder.
- [x] TypeScript strict configs for host, webview, shared; ESLint and Prettier.
- [x] vitest with one test; `@vscode/test-cli` with one integration test that runs the hello command.
- [x] `.vscode/launch.json` and `tasks.json` for F5 debugging.
- [x] GitHub Actions CI per arch §9 (no publish step yet).
- [x] `vsce package --no-dependencies` produces a VSIX that installs and runs.

### Feasibility spike (throwaway code on a `spike/` branch, not merged)
Scope is the two MVP providers only (ADR-0025), in VS Code stable on Linux only (ADR-0026): `vscode.lm` with GitHub Copilot Free, and Claude Code. Codex, Gemini, Kiro, and forks move to S7; Windows and macOS to S13.

- [ ] Work through the S0 checklist in arch §4: `vscode.lm` with Copilot Free (models offered, consent, errors, quota-exhausted error, system-message support); Claude Code headless flags, tools-off mode, auth errors (done on Linux; Windows path resolution moves to S13).
- [ ] Ask both providers for the line-tagged protocol (arch §5) on three sample files; check that each follows it closely enough to parse. Note failure modes for the parser tests.
- [ ] Measure time to first token for both providers on a 300-line file.
- [ ] Check the Marketplace for the name "LogicLens" and pick a publisher ID (Open VSX check moves to S7, ADR-0026).

### Decisions to close
- [ ] ADR-0017 (engine version): move to Accepted or record why still open. (ADR-0016, Kiro, moved to S7 by ADR-0025.)
- [ ] ADR-0007 (protocol): confirm or amend with evidence from Copilot Free and Claude Code. ADR-0005: Claude Code evidence recorded.
- [ ] Update arch §4 adapter table with verified invocations.

## Progress notes

- Skeleton verified locally: build, typecheck, lint, format check, unit test, integration test on VS Code 1.90.0, audit, gitleaks (staged files), VSIX package and install.
- Spike: Claude Code CLI verified (arch §4). Still to do: `vscode.lm` with Copilot Free (needs a GitHub account signed in to Copilot Free in VS Code), protocol trial, 300-line timing, Marketplace name check.
- 2026-11-01: scope cut to Copilot Free and Claude Code (ADR-0025). Codex, Gemini, Kiro, and fork checks moved to S7, after S12.
- CI ran green on PR #1 (s0-skeleton) on 2026-11-01; the PR is merged.
- ADR-0011 Accepted; ADR-0017 Proposed `^1.90.0`; ADR-0005 has Claude Code evidence; ADR-0016 and ADR-0007 untouched.

## Exit check

- [x] CI green on a pull request: typecheck, lint, unit, integration, audit, gitleaks, package (PR #1).
- [ ] Spike findings recorded in arch §4; ADRs updated.
- [x] Any provider found unworkable is removed from spec §6 or moved to post-MVP, with a note. (Done by scope: everything except Copilot Free and Claude Code moved to S7, ADR-0025.)
