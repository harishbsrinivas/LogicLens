# ADR-0031: A settings page webview; explanations stay inline

- **Status:** Accepted (S14)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §16, §7; arch §6, §8, §9; plan S14. Amends ADR-0028 ("There is no webview").

## Context
The project owner asked for a LogicLens settings page. LogicLens has 16 settings spread across providers, explanation style, privacy, display, cache, CLI, and debugging. VS Code's Settings editor filtered to the extension lists them alphabetically, without the provider status or the actions that belong with them (choose provider, reset notices, clear cache). ADR-0028 removed every webview so explanations render inline with native APIs, and SECURITY.md requires a new ADR, a strict CSP with a per-load nonce, no remote resources, and validated messages before any webview returns.

## Decision
- Add one webview: a `WebviewPanel` editor tab, "LogicLens Settings" (`ui/settingsPanel.ts`), opened by `logiclens.openSettings`. Explanations, questions, and bookmarks stay inline and native exactly as ADR-0028 decided.
- The page shows and edits settings only. It never receives code, prompts, model output, or keys.
- Security: CSP `default-src 'none'`, scripts only by a fresh 128-bit nonce on each load, styles, images, and fonts only from the webview's resource origin; no inline scripts or styles; no remote resources; `localResourceRoots` limited to `dist/webview` and `media`; command URIs off. The page script builds the DOM with `textContent` only.
- Messages from the page are untrusted: `set` is checked against a fixed schema (`settings/schema.ts`: key, type, choices, minimum, pattern, length) and writes user settings only; `action` runs one of a fixed list of commands. Anything else is ignored.
- The page script is plain TypeScript bundled by esbuild into `dist/webview/settings.js`. No UI framework and no new runtime dependency.

## Alternatives considered
- Open VS Code's Settings editor filtered to `@ext:logiclens-dev.logiclens`: no webview, but no grouping, no provider status, and no actions next to their settings. Still reachable through **Open settings.json** and the Settings editor.
- A quick-pick wizard: native and safe, but one setting at a time and no overview.
- Bring back Svelte for the page: a framework and a second build tool for one form.

## Consequences
- A webview, CSP, and message bridge are back in the VSIX, limited to settings. A unit test keeps the schema equal to `package.json` contributions, and integration tests check the CSP and that invalid messages change nothing.
- The page writes user settings only; workspace values for resource-scoped settings still apply and are shown as such.
- New settings must be added to `settings/schema.ts` as well as `package.json`, or the schema test fails.
