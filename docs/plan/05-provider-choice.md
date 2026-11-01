# S5. Provider Choice

**Status:** In progress: implemented on `s5-provider-choice` (stacked on `s4-ask-at-any-line`); unit and integration tests pass with fake providers. Exit check open: the demo script needs a person with Copilot Free.
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

- [x] `providers/registry.ts` with unit tests (auto resolution, timeouts, caching).
- [x] `ui/statusBar.ts`, `commands/provider.ts`, `ui/providerPicker.ts`.
- [x] No-provider notification and status bar warning state.
- [x] Notice storage per provider (already keyed per provider since S1; no migration needed); `logiclens.resetDataNotices`.
- [x] **Regenerate with…** on the explanation thread.
- [x] Integration tests: picker lists fake providers with states; switching changes the next request; failing provider shows fix action and does not fall back.

## Demo script

1. With Copilot Free signed in, the status bar shows "Copilot · <model>".
2. Click it; pick a different model family offered on Copilot Free; explain again; footer shows the new model.
3. Sign out of Copilot (or disable it); a notification offers **Choose Provider** and the picker shows the state of each provider.
4. Run "Reset Data Notices"; the next request shows the notice again.

## Progress notes

- 2026-11-01: the no-provider notification appears on the first refused request, with **Choose Provider**; the status bar shows the warning state from activation. A notification on activation itself would fire in windows where LogicLens is not used.
- Errors before output that another provider or model would fix (`auth`, `quota`, `not-found`) and `provider-unavailable` refusals show **Choose Provider**. Nothing switches provider on its own.

## Exit check

- [ ] Demo script passes.
- [x] All tests green (local: unit and integration, VS Code 1.90.0, Linux).
