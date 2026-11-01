# 9. Build, Test, and Release

## Toolchain (ADR-0011)

- TypeScript 6.0 (strict). TypeScript 7 waits until typescript-eslint supports it.
- Node 22.12+ for tooling (vitest and Vite require it). The host bundle targets `node20`, the extension host Node of the minimum engine (ADR-0017).
- pnpm for dependencies.
- esbuild bundles `src/extension.ts` to `dist/extension.js` (CommonJS, `vscode` external, minified for release, sourcemaps for dev).
- Vite builds `webview/` (Svelte 5 via `@sveltejs/vite-plugin-svelte`) to `dist/webview/` (`webview/vite.config.mts`, fixed output names `main.js` and `main.css`, one CSS file so nothing is inlined under the CSP).
- ESLint (typescript-eslint) and Prettier (with `prettier-plugin-svelte`). Lint rule restricting provider imports (arch §3). `svelte-check` typechecks the webview components.
- `@vscode/vsce` packages the VSIX with `--no-dependencies` (everything is bundled, which also avoids pnpm symlink issues in vsce). Until a repository URL and license exist, packaging also passes `--no-rewrite-relative-links --allow-missing-repository --skip-license`. `.vscodeignore` allowlists `dist/extension.js`, `dist/webview/`, and the manifest files. Release builds are platform-specific (`--target linux-x64` and `linux-arm64`) so the Marketplace offers them to Linux only (ADR-0026). `ovsx` publishing to Open VSX starts in S7.
- `pnpm-workspace.yaml` allows install scripts only for esbuild (`@vscode/vsce-sign` explicitly denied) and holds `overrides` for audited transitive fixes, each with its advisory ID.

## Scripts (target)

| Script | Does |
|---|---|
| `pnpm build` | esbuild (dev, sourcemaps) + Vite |
| `pnpm build:release` | esbuild minified + Vite |
| `pnpm watch` / `pnpm watch:webview` | watch mode; `.vscode/tasks.json` runs both for F5 |
| `pnpm typecheck` | `tsc --noEmit` for host, webview, shared, integration tests; `svelte-check` for components |
| `pnpm lint` | ESLint |
| `pnpm format:check` | Prettier check (Markdown excluded) |
| `pnpm test:unit` | vitest |
| `pnpm test:integration` | builds, compiles `test/integration` to `out/`, runs `@vscode/test-cli` against VS Code 1.90.0 (the minimum engine) |
| `pnpm eval` | evaluation runner over `test/eval/` with a chosen provider (local only; uses real providers) |
| `pnpm package` | release build + VSIX |

## Tests

- **Unit (vitest):** protocol parser (including malformed and chunk-split fixtures), anchor, context builder and budgeting, range tracker, secret scan, exclusion matching, prompt rendering snapshots, CLI output parsers against recorded streams, SSE reader.
- **Integration (@vscode/test-electron):** with a `FakeProvider` registered through a test-only hook (`activate` returns a `TestApi` only when `extensionMode` is `Test`: swap provider and prompter, override trust, read panel state), cover every command, panel messages, decorations applied, comment threads created and streamed, gate refusals, untrusted workspace, no implicit send.
- **Webview component tests:** vitest with jsdom (`test/unit/webview/`, typechecked with the webview tsconfig) mounting the Svelte app: panel states, message bridge, sanitization; later the step list and keyboard navigation.
- **Evaluation:** spec §10; not in CI by default because it needs real providers. A nightly optional job can run it with a repository secret for one HTTP provider.
- **Manual matrix before release:** VS Code stable and Insiders on Linux, with Copilot Free and Claude Code; light, dark, high contrast (ADR-0026). Windows and macOS join in S13; Cursor and Kiro smoke tests in S7.

## CI (GitHub Actions)

On pull request and push to `main` (`.github/workflows/ci.yml`): install with frozen lockfile, typecheck, lint, format check, unit tests, integration tests under `xvfb-run` on Linux, `pnpm audit --audit-level=high`, gitleaks (release binary pinned by version and SHA-256), package VSIX and upload as artifact. Actions pinned by SHA, `permissions: contents: read`, checkout without persisted credentials.

On tag `v*`: same, then package the `linux-x64` and `linux-arm64` VSIXs, publish them to the VS Code Marketplace (`vsce publish --packagePath`) using environment-protected secrets, and attach them to a GitHub release. Open VSX (`ovsx publish`) is added in S7.

## Versioning

Semantic versioning. Pre-1.0 releases may use the Marketplace pre-release channel (`--pre-release`). Changelog in `CHANGELOG.md`, updated per slice.
