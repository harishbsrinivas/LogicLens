# S0. Preflight and Feasibility Spike

**Status:** In progress. Skeleton done; spike partial (Claude Code only); CI not yet run (no remote).
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
- [ ] Work through the S0 checklist in arch §4: `vscode.lm` in VS Code and forks; Claude Code, Codex, Gemini, Kiro CLI headless flags, tools-off mode, auth errors, Windows behavior.
- [ ] Ask one model for the line-tagged protocol (arch §5) on three sample files; check that every provider follows it closely enough to parse. Note failure modes for the parser tests.
- [ ] Measure time to first token per provider on a 300-line file.
- [ ] Check Marketplace and Open VSX for the name "LogicLens" and pick a publisher ID.

### Decisions to close
- [ ] ADR-0016 (Kiro path), ADR-0017 (engine version): move to Accepted or record why still open.
- [ ] ADR-0007 (protocol) and ADR-0005 (CLI headless): confirm or amend with spike evidence.
- [ ] Update arch §4 adapter table with verified invocations.

## Progress notes

- Skeleton verified locally: build, typecheck, lint, format check, unit test, integration test on VS Code 1.90.0, audit, gitleaks (staged files), VSIX package and install.
- Spike: Claude Code CLI verified (arch §4). Not possible on this machine yet: `vscode.lm` with Copilot, Codex, Gemini, Kiro, forks, protocol trial, 300-line timing, Marketplace name check.
- ADR-0011 Accepted; ADR-0017 Proposed `^1.90.0`; ADR-0005 has Claude Code evidence; ADR-0016 and ADR-0007 untouched.

## Exit check

- [ ] CI green on a pull request: typecheck, lint, unit, integration, audit, gitleaks, package.
- [ ] Spike findings recorded in arch §4; ADRs updated.
- [ ] Any provider found unworkable is removed from spec §6 or moved to post-MVP, with a note.
