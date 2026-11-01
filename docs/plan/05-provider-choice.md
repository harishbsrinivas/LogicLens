# S5. Provider Choice

**Status:** Not started
**User value:** the status bar shows which AI is in use; one click switches provider or model. When nothing is ready, the panel explains how to set one up.
**Spec:** §6 (detection, selection, fallback, cost transparency), §2 J5, §8 (per-provider notice)

## Scope

In:
- Provider registry with parallel detection, states, caching, change events (arch §4).
- `clarity.provider` and `clarity.model` settings with `auto` resolution.
- Status bar item with provider and model; click opens the picker.
- Provider and model quick picks (`clarity.selectProvider`, `clarity.selectModel`) grouped by state, with inline actions.
- Panel setup view when no provider is ready.
- Per-provider data notice and `clarity.resetDataNotices`.
- Panel header provider menu: regenerate the current walkthrough with another provider.
- Errors with a single fix action; no silent provider switch.
- Only the `vscode-lm` adapter exists so far, but `vscode-lm` exposes one entry per vendor/model family, so users can already switch between, for example, Copilot's Claude and GPT models.

Out: new adapters (S6, S7).

## Tasks

- [ ] `providers/registry.ts` with unit tests (auto resolution, timeouts, caching).
- [ ] `ui/statusBar.ts`, `commands/provider.ts`.
- [ ] Setup view component in the webview.
- [ ] Notice storage per provider; migrate the S1 single notice.
- [ ] Integration tests: picker lists fake providers with states; switching changes the next request; failing provider shows fix action and does not fall back.

## Demo script

1. With Copilot signed in, the status bar shows "Copilot · <model>".
2. Click it; pick a different model family; explain again; footer shows the new model.
3. Sign out of Copilot (or disable it); the panel shows the setup view with the state of each provider.
4. Run "Reset Data Notices"; the next request shows the notice again.

## Exit check

- [ ] Demo script passes.
- [ ] All tests green.
