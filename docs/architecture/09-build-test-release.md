# 9. Build, Test, and Release

## Toolchain (ADR-0011)

- TypeScript 6.0 (strict). TypeScript 7 waits until typescript-eslint supports it.
- Node 22.12+ for tooling (vitest and Vite require it). The host bundle targets `node20`, the extension host Node of the minimum engine (ADR-0017).
- pnpm for dependencies.
- esbuild bundles `src/extension.ts` to `dist/extension.js` (CommonJS, `vscode` external, minified for release, sourcemaps for dev).
- Vite builds `webview/` to `dist/webview/` (`webview/vite.config.mts`, fixed output name `main.js`).
- ESLint (typescript-eslint) and Prettier. Lint rule restricting provider imports (arch §3).
- `@vscode/vsce` packages the VSIX with `--no-dependencies` (everything is bundled, which also avoids pnpm symlink issues in vsce). Until a repository URL and license exist, packaging also passes `--no-rewrite-relative-links --allow-missing-repository --skip-license`. `.vscodeignore` allowlists `dist/extension.js`, `dist/webview/`, and the manifest files. `ovsx` publishes to Open VSX.
- `pnpm-workspace.yaml` allows install scripts only for esbuild (`@vscode/vsce-sign` explicitly denied) and holds `overrides` for audited transitive fixes, each with its advisory ID.

## Scripts (target)

| Script | Does |
|---|---|
| `pnpm build` | esbuild (dev, sourcemaps) + Vite |
| `pnpm build:release` | esbuild minified + Vite |
| `pnpm watch` / `pnpm watch:webview` | watch mode; `.vscode/tasks.json` runs both for F5 |
| `pnpm typecheck` | `tsc --noEmit` for host, webview, shared |
| `pnpm lint` | ESLint |
| `pnpm format:check` | Prettier check (Markdown excluded) |
| `pnpm test:unit` | vitest |
| `pnpm test:integration` | builds, compiles `test/integration` to `out/`, runs `@vscode/test-cli` against VS Code 1.90.0 (the minimum engine) |
| `pnpm eval` | evaluation runner over `test/eval/` with a chosen provider (local only; uses real providers) |
| `pnpm package` | release build + VSIX |

## Tests

- **Unit (vitest):** protocol parser (including malformed and chunk-split fixtures), anchor, context builder and budgeting, range tracker, secret scan, exclusion matching, prompt rendering snapshots, CLI output parsers against recorded streams, SSE reader.
- **Integration (@vscode/test-electron):** with a `FakeProvider` registered through a test-only hook, cover every command, panel messages, decorations applied, comment threads created and streamed, gate refusals, untrusted workspace, no implicit send.
- **Webview component tests:** vitest with a DOM environment for step list, keyboard navigation, sanitization.
- **Evaluation:** spec §10; not in CI by default because it needs real providers. A nightly optional job can run it with a repository secret for one HTTP provider.
- **Manual matrix before release:** VS Code stable and Insiders on Windows, macOS, Linux; Cursor and Kiro smoke test if available; light, dark, high contrast.

## CI (GitHub Actions)

On pull request and push to `main` (`.github/workflows/ci.yml`): install with frozen lockfile, typecheck, lint, format check, unit tests, integration tests under `xvfb-run` on Linux, `pnpm audit --audit-level=high`, gitleaks (release binary pinned by version and SHA-256), package VSIX and upload as artifact. Actions pinned by SHA, `permissions: contents: read`, checkout without persisted credentials.

On tag `v*`: same, then publish to the VS Code Marketplace (`vsce publish`) and Open VSX (`ovsx publish`) using environment-protected secrets, then attach the VSIX to a GitHub release.

## Versioning

Semantic versioning. Pre-1.0 releases may use the Marketplace pre-release channel (`--pre-release`). Changelog in `CHANGELOG.md`, updated per slice.
