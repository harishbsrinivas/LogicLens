# ADR-0011: TypeScript, esbuild, Vite, pnpm, vitest, and @vscode/test-cli

- **Status:** Accepted (S0)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** arch §9

## Context
VS Code extensions run in Node in the extension host; the panel runs in a browser-like webview. Package size and activation time matter. The project owner standardizes on pnpm.

## Decision
TypeScript strict, on the 6.0 line until typescript-eslint supports TypeScript 7. esbuild bundles the host to one CommonJS file. Vite builds the webview. pnpm for dependencies; package with `vsce --no-dependencies` since everything is bundled. vitest for unit tests; `@vscode/test-cli` and `@vscode/test-electron` for integration tests.

## Alternatives considered
- webpack: slower, more configuration.
- Jest: slower; vitest shares Vite config.
- npm: project-wide rule is pnpm.

## Consequences
- `node_modules` never shipped in the VSIX.
- Two build pipelines (host and webview) run by one script.
- S0 evidence: build, typecheck, lint, vitest, `@vscode/test-cli` against VS Code 1.90.0, and `vsce package --no-dependencies` all run on this stack; the VSIX installs.
- Tooling needs Node 22.12+ (vitest 5, Vite 8). The shipped bundle still targets the extension host's Node.
