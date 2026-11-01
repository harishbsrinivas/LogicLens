# S14. Settings Page

**Status:** In progress: implemented on `s14-settings-page` (stacked on `s11-bookmarks`); unit and integration tests pass, including the real page script loading under its CSP. Exit check open: the demo script needs a person (themes, keyboard, screen reader).
**User value:** one LogicLens settings page, grouped by what each setting affects, with provider status and the related actions next to the settings.
**Spec:** §16, §7, §9
**Added:** 2026-11-01 at the project owner's request. Ships before S9 with the MVP.

## Scope

In:
- `logiclens.openSettings` (palette, Bookmarks view title, Adjust Explanation…) opening one `WebviewPanel` editor tab.
- Every contributed setting, grouped into seven sections, with help text, Reset, workspace-override notes, and validation errors.
- Provider status and model list from the registry; buttons for the provider picker, Reset Data Notices, View Terms, Clear Cache, Show Log, and Open settings.json.
- ADR-0031 (amends ADR-0028): one settings-only webview with a nonce CSP and validated messages.
- `logiclens.showLog` (in spec §9 since S1, not built until now).

Out: editing workspace settings from the page; personality (arrives with S12, which adds it to the schema).

## Tasks

- [x] `settings/schema.ts` with validation; unit test that it matches `package.json` contributions exactly.
- [x] `ui/settingsPanel.ts`: HTML with nonce CSP, state messages, validated `set`, `reset`, and fixed `action`s.
- [x] `src/webview/settings.ts` and `media/settings.css`: DOM with `textContent` only, labels and descriptions, focus kept across updates, theme variables only.
- [x] Build: second esbuild bundle, `tsconfig.webview.json`, ESLint browser globals, `.vscodeignore`.
- [x] Integration tests: CSP shape, single nonce script, page script runs and posts `ready`, valid change written to user settings, invalid messages change nothing, actions limited to the fixed list.
- [x] Docs: spec §16 (new), §7, §9; ADR-0031; arch §1, §2, §3, §6, §8, §9; SECURITY.md; DEVELOPMENT.md.

## Demo script

1. Run **LogicLens: Open Settings**. The page opens in a tab with seven sections and the provider list showing Copilot as Ready.
2. Change Depth to Detailed; `settings.json` shows `"logiclens.depth": "detailed"`. Click Reset; it is gone.
3. Type `english` into Explanation language; an error says it is not valid and nothing is saved.
4. Add `**/fixtures/**` to the exclude list; an Explain File on a file under `fixtures/` is refused.
5. Click **Clear cache** and **Reset data notices**; both take effect.
6. Switch to a light, dark, and high-contrast theme; the page follows. Tab through every control; each has a visible focus ring and its label is read by the screen reader.

## Progress notes

- 2026-11-01: an early test run showed the S5 "Reset Data Notices" integration test depended on an earlier test's notice; it now sets the notice itself.
- The page writes user settings only; a workspace value for `depth`, `audience`, `jargon`, or `maxLines` is shown as a note because it still applies there.

## Exit check

- [ ] Demo script passes in light, dark, and high-contrast themes on Linux.
- [x] All tests green (local: unit and integration, VS Code 1.90.0, Linux).
