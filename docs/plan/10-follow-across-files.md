# S10. Follow Across Files

**Status:** Not started
**User value:** follow a call into another file, and another, then get back to the exact step they started from with one click on a breadcrumb.
**Spec:** §13, §2 J7, §7 (CodeLens rows), §9

## Scope

In:
- `logiclens.followDefinition` from the editor context menu, palette, keybinding, and a focused step's "Follow…" menu. Uses `vscode.executeDefinitionProvider`; quick pick when several results.
- Trail model in `src/nav/trail.ts`: linear history, cap 30, forward entries dropped on a new follow, persisted in `workspaceState`.
- Restore on navigation: reopen file, restore scroll and cursor, restore focused step from session state or cache.
- Breadcrumb CodeLens row above line 1, overflow `…` quick pick, "(missing)" crumbs for missing files, lock icon for excluded files.
- `logiclens.trailBack`, `logiclens.trailForward`, `logiclens.clearTrail`; context keys `logiclens.trailCanGoBack`, `logiclens.trailCanGoForward`.
- **Explain <symbol>** CodeLens when landing in a file with no walkthrough (reuses S3 symbol target).

Out: recording native Go to Definition (ADR-0021), sending definition source as prompt context (post-MVP).

## Tasks

- [ ] `nav/trail.ts` pure model with unit tests: push, back, forward, branch truncation, cap, serialize and restore, missing-file handling.
- [ ] Follow command with a fake definition provider in integration tests (single, multiple, none).
- [ ] Step "Follow…" menu: symbols referenced in the step's range from `executeDocumentSymbolProvider` and word ranges; unit tests.
- [ ] Trail CodeLens provider (arch §6): crumb commands carry only the entry index; the trail service validates it.
- [ ] Crumb overflow quick pick, current-crumb marker, keyboard navigation, announcements.
- [ ] Integration test: follow does not create a provider request (extend `noImplicitSend`).
- [ ] Update arch §3, §6, §7 with anything that changed.

## Demo script

1. Explain `app.ts`; focus step 3; put the cursor on a call to a function in `auth.ts` and press Ctrl+Alt+E G.
2. `auth.ts` opens at the definition; the trail row above line 1 shows both files. A CodeLens offers **Explain verifyUser**; click it.
3. Follow once more into `token.ts`.
4. Click the `app.ts` crumb: editor returns to the original spot with step 3 focused.
5. Press Ctrl+Alt+E ] twice: forward to `token.ts`.
6. Go back to `auth.ts`, follow something else: the `token.ts` crumb disappears.
7. Reload the window: the trail is still there.

## Exit check

- [ ] Demo script passes.
- [ ] No provider request during any follow or trail navigation (integration test).
- [ ] All tests green.
