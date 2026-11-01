# S2. Step-by-Step Walkthrough

**Status:** Not started
**User value:** the explanation becomes a guided walkthrough: overview, numbered steps tied to line ranges, and a summary. Each step appears inline above its lines; clicking its title or pressing Alt+] opens its explanation and highlights its lines.
**Spec:** §4 (all except depth/audience controls), §7 (inline layout, highlight, accessibility), §10 (output contract, failure handling)

## Scope

In:
- Prompt `walkthrough.system` v1 with the line-tagged protocol (arch §5).
- Incremental protocol parser and anchor validator.
- State store for walkthroughs per document, focus state.
- Inline threads (ADR-0028): overview thread at line 1 (summary and things to watch added when finished), one thread per step under its first line with only the focused one expanded, "Show all", concept tags (display only; click wired in S4).
- Step title CodeLens rows with Previous and Next.
- Decorations: focus highlight, dimming, gutter step numbers; reveal on focus.
- Commands `logiclens.nextStep`, `logiclens.previousStep`, `logiclens.clearFocus`; context keys; default keybindings.
- Follow-cursor mode.
- Partial-failure handling: keep finished steps, **Continue** for truncated output, plain-Markdown fallback when not parseable.
- Accessibility: step announcements (confirm a mechanism without a webview live region, ADR-0028), keyboard-only reading through commands, CodeLens, and Accessible View.

Out: depth and audience controls (S3), Ask buttons (S4), range tracking on edits (S8; for now, editing the document marks the whole walkthrough stale).

## Tasks

- [ ] `explain/protocol.ts` with unit tests: happy path, chunk boundaries mid-line and mid-tag, missing `@@overview`, missing `@@end`, unknown tags, malformed ranges, Windows line endings.
- [ ] `explain/anchor.ts` with unit tests: in range, clamp within 2 lines, unanchored, multi-range.
- [ ] `state/` walkthrough store and events.
- [ ] `ui/decorations.ts` and gutter SVG generator; integration test asserting decorations applied to the right ranges.
- [ ] Step threads and step title CodeLens in `ui/inlineThreads.ts` and `ui/codeLens.ts`; integration tests for expand/collapse on focus.
- [ ] Per-thread throttled body updates (about 100 ms, as in S1).
- [ ] Eval runner skeleton in `test/eval/` computing parse, anchor, and coverage rates; seed corpus with 10 files.
- [ ] Remove S1's Markdown-only prompt or keep it as the fallback renderer only.

## Demo script

1. Explain a 200-line Python file. Overview appears, then steps one by one.
2. Click step 3: editor scrolls, lines highlight, others dim, gutter shows "3".
3. Press Alt+] and Alt+[ to move between steps; Escape clears the highlight.
4. Move the cursor into step 5's lines; step 5 becomes the focused step.
5. Switch to another tab and back; the walkthrough is still there.
6. Use only the keyboard to read all steps, with a screen reader announcing each.

## Exit check

- [ ] Demo script passes in light, dark, and high-contrast themes.
- [ ] Eval seed corpus with the default provider: parse rate ≥ 90%, anchor rate ≥ 85% (tightened to MVP targets in S9).
- [ ] All tests green.
