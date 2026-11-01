# S2. Step-by-Step Walkthrough

**Status:** Not started
**User value:** the explanation becomes a guided walkthrough: overview, numbered steps tied to line ranges, and a summary. Clicking a step or pressing Alt+] highlights its lines in the editor.
**Spec:** §4 (all except depth/audience controls), §7 (panel layout, highlight, accessibility), §10 (output contract, failure handling)

## Scope

In:
- Prompt `walkthrough.system` v1 with the line-tagged protocol (arch §5).
- Incremental protocol parser and anchor validator.
- State store for walkthroughs per document, focus state.
- Panel: overview, step list with expand/collapse and "Show all", concepts chips (display only; click wired in S4), summary and things to watch, streaming progress line.
- Decorations: focus highlight, dimming, gutter step numbers; reveal on focus.
- Commands `logiclens.nextStep`, `logiclens.previousStep`, `logiclens.clearFocus`; context keys; default keybindings.
- Follow-cursor mode.
- Panel follows the active editor (shows that document's walkthrough or the empty state).
- Partial-failure handling: keep finished steps, **Continue** for truncated output, plain-Markdown fallback when not parseable.
- Accessibility: list roles, step announcements, polite live region, keyboard navigation in the panel.

Out: depth and audience controls (S3), Ask buttons (S4), range tracking on edits (S8; for now, editing the document marks the whole walkthrough stale).

## Tasks

- [ ] `explain/protocol.ts` with unit tests: happy path, chunk boundaries mid-line and mid-tag, missing `@@overview`, missing `@@end`, unknown tags, malformed ranges, Windows line endings.
- [ ] `explain/anchor.ts` with unit tests: in range, clamp within 2 lines, unanchored, multi-range.
- [ ] `state/` walkthrough store and events.
- [ ] `ui/decorations.ts` and gutter SVG generator; integration test asserting decorations applied to the right ranges.
- [ ] Webview step list components with keyboard navigation; component tests.
- [ ] Batched delta posting (about 30 ms).
- [ ] Eval runner skeleton in `test/eval/` computing parse, anchor, and coverage rates; seed corpus with 10 files.
- [ ] Remove S1's Markdown-only prompt or keep it as the fallback renderer only.

## Demo script

1. Explain a 200-line Python file. Overview appears, then steps one by one.
2. Click step 3: editor scrolls, lines highlight, others dim, gutter shows "3".
3. Press Alt+] and Alt+[ to move between steps; Escape clears the highlight.
4. Move the cursor into step 5's lines; step 5 highlights in the panel.
5. Switch to another tab and back; the walkthrough is still there.
6. Use only the keyboard to read all steps, with a screen reader announcing each.

## Exit check

- [ ] Demo script passes in light, dark, and high-contrast themes.
- [ ] Eval seed corpus with the default provider: parse rate ≥ 90%, anchor rate ≥ 85% (tightened to MVP targets in S9).
- [ ] All tests green.
