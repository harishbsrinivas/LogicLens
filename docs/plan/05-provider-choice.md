# S5. Provider Choice

**Status:** Not started
**User value:** the status bar shows which AI is in use; one click switches provider or model. When nothing is ready, a notification opens the provider picker, which explains how to set one up.
**Spec:** §6 (detection, selection, fallback, cost transparency), §2 J5, §8 (per-provider notice)

## Scope

In:
- Provider registry with parallel detection, states, caching, change events (arch §4).
- `logiclens.provider` and `logiclens.model` settings with `auto` resolution.
- Status bar item with provider and model; click opens the picker.
- Provider and model quick picks (`logiclens.selectProvider`, `logiclens.selectModel`) grouped by state, with inline actions.
- No provider ready: notification with **Choose Provider**, status bar warning state, picker shows setup actions.
- Per-provider data notice and `logiclens.resetDataNotices`.
- **Regenerate with…** title action on the explanation thread: regenerate the current walkthrough with another provider.
- Errors with a single fix action; no silent provider switch.
- Only the `vscode-lm` adapter exists so far, but `vscode-lm` exposes one entry per vendor/model family, so users can already switch between, for example, Copilot's Claude and GPT models.

Out: new adapters (S6; S7 after release).

## Tasks

- [ ] `providers/registry.ts` with unit tests (auto resolution, timeouts, caching).
- [ ] `ui/statusBar.ts`, `commands/provider.ts`.
- [ ] No-provider notification and status bar warning state.
- [ ] Notice storage per provider; migrate the S1 single notice.
- [ ] Integration tests: picker lists fake providers with states; switching changes the next request; failing provider shows fix action and does not fall back.

## Demo script

1. With Copilot Free signed in, the status bar shows "Copilot · <model>".
2. Click it; pick a different model family offered on Copilot Free; explain again; footer shows the new model.
3. Sign out of Copilot (or disable it); a notification offers **Choose Provider** and the picker shows the state of each provider.
4. Run "Reset Data Notices"; the next request shows the notice again.

## Exit check

- [ ] Demo script passes.
- [ ] All tests green.
