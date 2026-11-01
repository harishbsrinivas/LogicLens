# S3. More Targets and Controls

**Status:** Not started
**User value:** explain just a selection or a function, start from the Explorer, use CodeLens, and tune depth and audience.
**Spec:** §3 (all entry points and limits), §4 (depth, audience, explanation language), §9

## Scope

In:
- `clarity.explainSelection` (editor context menu, keybinding), selection expanded to whole lines, target markers in the prompt.
- `clarity.explainSymbol` with a symbol quick pick from the document symbol provider.
- Explorer context menu "Clarity: Explain File" opening the file in a preview tab and starting the walkthrough.
- CodeLens "Explain" above symbols behind `clarity.codeLens.enabled`.
- Context budgeting (arch §5 step 3) with omitted-lines markers; `countTokens` for `vscode-lm`.
- Large-file flow: offer selection, visible range, or symbol when over `clarity.maxLines`.
- Generated or minified file warning.
- Depth and audience: settings, panel chips, quick-pick commands, regenerate with confirmation; prompt variants.
- `clarity.explanationLanguage` with `auto` following `vscode.env.language`.
- Editor context menu "Explain File".

Out: folders and multi-select (post-MVP), notebooks.

## Tasks

- [ ] Target resolution for selection and symbol; unit tests for line expansion and markers.
- [ ] Budgeting algorithm with unit tests (target always whole, symbol next, outward expansion).
- [ ] Prompt variants for depth and audience; snapshot tests; bump prompt version.
- [ ] Explorer and editor menu contributions with `when` clauses (hide for excluded files using `clarity.fileExcluded`).
- [ ] CodeLens provider; integration test toggling the setting.
- [ ] Panel header chips for depth and audience.
- [ ] Grow eval corpus to 30 files; run at each depth and check step counts fall in range.

## Demo script

1. Select a 30-line function in a 1,500-line file and press Ctrl+Alt+E S. Steps refer only to the selection's lines.
2. Right-click a file in the Explorer, choose Explain File; it opens and the walkthrough starts.
3. Enable CodeLens; click "Explain" above a class.
4. Switch depth to Overview, then Detailed; step counts change accordingly.
5. Open a 5,000-line file; Clarity offers selection, visible range, or symbol.

## Exit check

- [ ] Demo script passes.
- [ ] Step count per depth on the eval corpus within spec §4 ranges for ≥ 90% of files.
- [ ] All tests green.
