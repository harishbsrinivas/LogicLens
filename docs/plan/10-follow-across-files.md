# S10. Follow Across Files

**Status:** In progress: implemented on `s10-follow-across-files` (stacked on `s8-cache-and-staleness`); unit and integration tests pass with test definition and symbol providers. Exit check open: the demo script needs a person and real language servers.
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

- [x] `nav/trail.ts` pure model with unit tests: push, back, forward, branch truncation, cap, serialize and restore, missing-file handling.
- [x] Follow command with a fake definition provider in integration tests (single, multiple, none).
- [x] Step "Follow…" menu: identifiers on the step's lines (unit tested), kept when the definition provider finds a definition elsewhere.
- [x] Trail CodeLens provider (arch §6): crumb commands carry only the entry index; the trail service validates it.
- [x] Crumb overflow quick pick, current-crumb marker, keyboard navigation (Trail Back and Forward keys), status bar announcements.
- [x] Integration test: follow and trail navigation create no provider request.
- [x] Update arch §3, §6, §7 with anything that changed.

## Demo script

1. Explain `app.ts`; focus step 3; put the cursor on a call to a function in `auth.ts` and press Ctrl+Alt+E G.
2. `auth.ts` opens at the definition; the trail row above line 1 shows both files. A CodeLens offers **Explain verifyUser**; click it.
3. Follow once more into `token.ts`.
4. Click the `app.ts` crumb: editor returns to the original spot with step 3 focused.
5. Press Ctrl+Alt+E ] twice: forward to `token.ts`.
6. Go back to `auth.ts`, follow something else: the `token.ts` crumb disappears.
7. Reload the window: the trail is still there.

## Progress notes

- 2026-11-01: the spec's accessibility wording assumed a webview breadcrumb bar; with CodeLens crumbs (ADR-0028) the current crumb is marked with "●" and moves are announced in the status bar (spec §13 updated).
- Step **Follow…** checks each identifier with the definition provider and drops those whose only definition is where they stand.

## Exit check

- [ ] Demo script passes.
- [x] No provider request during any follow or trail navigation (integration test).
- [x] All tests green (local: unit and integration, VS Code 1.90.0, Linux).
