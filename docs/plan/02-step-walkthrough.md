# S2. Step-by-Step Walkthrough

**Status:** In progress (stacked on `s1-explain-file`; S1 exit check still needs the Copilot demo).
**User value:** the explanation becomes a guided walkthrough: overview, numbered steps tied to line ranges, and a summary. Each step appears inline above its lines; clicking its title or pressing Alt+] opens its explanation and highlights its lines.
**Spec:** §4 (all except depth/audience controls), §7 (inline layout, highlight, accessibility), §10 (output contract, failure handling)

## Scope

In:
- Prompt `walkthrough.system` v1 with the line-tagged protocol (arch §5).
- Incremental protocol parser and anchor validator.
- State store for walkthroughs per document, focus state.
- Inline threads (ADR-0028): overview thread at line 1 (summary and things to watch added when finished), one thread per step just above its code (ADR-0029) with only the focused one expanded, "Show all", concept tags (display only; click wired in S4).
- Step title CodeLens rows with Previous and Next.
- Decorations: focus highlight, dimming, gutter step numbers; reveal on focus.
- Commands `logiclens.nextStep`, `logiclens.previousStep`, `logiclens.clearFocus`; context keys; default keybindings.
- Follow-cursor mode.
- Partial-failure handling: keep finished steps, **Continue** for truncated output, plain-Markdown fallback when not parseable.
- Accessibility: step announcements (confirm a mechanism without a webview live region, ADR-0028), keyboard-only reading through commands, CodeLens, and Accessible View.

Out: depth and audience controls (S3), Ask buttons (S4), range tracking on edits (S8; for now, editing the document marks the whole walkthrough stale).

## Tasks

- [x] `explain/protocol.ts` with unit tests: happy path, chunk boundaries mid-line and mid-tag (every split point), missing `@@overview`, missing `@@end`, unknown tags, malformed ranges, Windows line endings, continuation mode.
- [x] `explain/anchor.ts` with unit tests: in range, clamp within 2 lines, unanchored, multi-range; metrics.
- [x] `state/` walkthrough store and events (structural vs streamed; focus, opened, showAll, raw response).
- [x] `ui/decorations.ts` and gutter SVG generator; integration test asserting decorations applied to the right ranges.
- [x] Step threads (just above their code, ADR-0029) and step title CodeLens in `ui/inlineThreads.ts` and `ui/codeLens.ts`; integration tests for placement, lenses, expand/collapse on focus, Show all.
- [x] Per-thread throttled body updates (about 100 ms, as in S1), skipped when a thread's content is unchanged.
- [x] Eval runner skeleton in `test/eval/` computing parse, anchor, and coverage rates; seed corpus with 10 files (TypeScript, JavaScript, Python, Go, Rust, Java, C#, C, Ruby, shell). Responses are recorded by hand (`test/eval/README.md`).
- [x] Remove S1's Markdown-only prompt; plain Markdown remains only as the fallback rendering.
- [x] Commands `logiclens.nextStep`, `previousStep`, `clearFocus`, `showAllSteps`, `continue`, internal `focusStep`; context keys `logiclens.walkthroughActive`, `logiclens.stepFocused`; keybindings; settings `logiclens.focusDimming`, `logiclens.followCursor`.
- [x] Follow-cursor mode, stale marking on edit, Continue for truncated or failed output, Markdown fallback when unstructured or mostly unanchored.

## Demo script

1. Explain a 200-line Python file. Overview appears, then steps one by one.
2. Click step 3: editor scrolls, lines highlight, others dim, gutter shows "3".
3. Press Alt+] and Alt+[ to move between steps; Escape clears the highlight.
4. Move the cursor into step 5's lines; step 5 becomes the focused step.
5. Switch to another tab and back; the walkthrough is still there.
6. Use only the keyboard to read all steps, with a screen reader announcing each.

## Progress notes

- 2026-11-01: the owner asked for explanations at the beginning of each code block rather than at the top of the file. Step threads are attached to the line before the step (ADR-0029). Unit (127) and integration (23, VS Code 1.90.0, Linux) tests pass with a fake provider.
- Step announcements use a status bar message. Whether Orca reads it is not yet checked; demo step 6 decides whether a different mechanism is needed (ADR-0028).
- Follow mode moves only the highlight (`focus`), not the open thread (`opened`), so blocks do not open and shift the code under the cursor while typing or clicking.
- Not yet run: the demo script in a real window, and the eval corpus against Copilot Free (needs recorded responses).

## Exit check

- [ ] Demo script passes in light, dark, and high-contrast themes.
- [ ] Eval seed corpus with the default provider: parse rate ≥ 90%, anchor rate ≥ 85% (tightened to MVP targets in S9).
- [ ] All tests green.
