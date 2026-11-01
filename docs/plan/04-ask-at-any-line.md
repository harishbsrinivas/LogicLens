# S4. Ask at Any Line

**Status:** In progress: implemented on `s4-ask-at-any-line` (stacked on `s2-step-walkthrough`); unit and integration tests pass with a fake provider. Exit check open: the demo script and the keyboard-only run need a person and Copilot Free.
**User value:** hover any line, click "+", type a question, and get an answer inline under that line. Ask follow-ups in the same thread. Ask from a walkthrough step or a concept chip.
**Spec:** §5, §2 J3 and J4

## Scope

In:
- `CommentController` with commenting ranges on all lines of eligible documents (trusted, not excluded, `file` or `untitled`).
- Thread creation from the gutter "+", from `logiclens.askAtLine` (cursor or selection), from a step thread's **Ask**, and from a concept tag (pre-filled).
- Question pipeline (arch §5 step 8): context per spec §5, related step, thread history with budget.
- Streaming answer into a Markdown comment, throttled; Stop; copy, regenerate, delete.
- `L<n>` references rendered as links that move the cursor.
- Simple in-memory range shift for threads when lines are inserted or removed above (full tracker in S8).
- Concurrency limit: two questions in flight; queue the rest.
- Clear threads in file and all threads.
- Measure activation time; decide open decision 4 (activation for the gutter "+").

Out: persistence across reloads (S8).

## Tasks

- [x] Question threads on the `ui/inlineThreads.ts` controller (commenting ranges, thread and comment models, menus via `contextValue`).
- [x] `explain/question.ts` and `prompts/question.ts` v1; unit tests for the prompt, window, and history budget.
- [x] Line-reference linkifier with unit tests.
- [x] Wire step **Ask** (thread title action) and concept tags (command links limited with `isTrusted: { enabledCommands }`; recorded in arch §8).
- [x] Integration tests with `FakeProvider`: create thread, stream, follow-up includes history, stop, regenerate, delete, refuses empty and over-length questions, refused in excluded files.
- [x] Document the multiple-commenting-provider picker behavior in the README draft.
- [x] Measure activation and decide open decision 4: keep lazy activation (ADR-0030).

## Demo script

1. In a Go file, hover line 42 and click "+". Type "why is this goroutine not leaking?" and press Enter.
2. Answer streams under the line with "LogicLens · Copilot/<model>".
3. Ask "what happens if ctx is cancelled first?" in the same thread; the answer uses the earlier turn.
4. In the walkthrough, click **Ask** on step 2; a thread opens at its first line.
5. Click a concept chip; a thread opens with the question pre-filled.
6. Insert three lines above the thread; it moves down with its line.

## Progress notes

- 2026-11-01: VS Code cannot pre-fill a comment input box, so a concept tag opens an input box with the question pre-filled and asks it in a new thread at the step (spec §5 updated).
- Gate refusals (excluded, untrusted, secrets) remove the question turn and an empty thread, then show the usual message.
- Range shifting is a pure function (`state/rangeShift.ts`) applied per edit, bottom-up; S8's tracker replaces it.

## Exit check

- [ ] Demo script passes.
- [ ] Keyboard-only run of the demo works (comment widget focus and submit).
- [x] All tests green (local: unit and integration, VS Code 1.90.0, Linux).
