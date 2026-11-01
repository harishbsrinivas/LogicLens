# S4. Ask at Any Line

**Status:** Not started
**User value:** hover any line, click "+", type a question, and get an answer inline under that line. Ask follow-ups in the same thread. Ask from a walkthrough step or a concept chip.
**Spec:** §5, §2 J3 and J4

## Scope

In:
- `CommentController` with commenting ranges on all lines of eligible documents (trusted, not excluded, `file` or `untitled`).
- Thread creation from the gutter "+", from `logiclens.askAtLine` (cursor or selection), from a step's **Ask**, and from a concept chip (pre-filled).
- Question pipeline (arch §5 step 8): context per spec §5, related step, thread history with budget.
- Streaming answer into a Markdown comment, throttled; Stop; copy, regenerate, delete.
- `L<n>` references rendered as links that move the cursor.
- Simple in-memory range shift for threads when lines are inserted or removed above (full tracker in S8).
- Concurrency limit: two questions in flight; queue the rest.
- Clear threads in file and all threads.
- Measure activation time; decide open decision 4 (activation for the gutter "+").

Out: persistence across reloads (S8).

## Tasks

- [ ] `ui/comments.ts` controller, thread and comment models, menus via `contextValue`.
- [ ] `explain/question.ts` and `prompts/question.ts` v1; snapshot tests.
- [ ] Line-reference linkifier with unit tests.
- [ ] Wire panel **Ask** and concept chips through the bridge.
- [ ] Integration tests with `FakeProvider`: create thread, stream, follow-up includes history, stop, regenerate, delete, refuses empty and over-length questions, refused in excluded files.
- [ ] Document the multiple-commenting-provider picker behavior in the README draft.

## Demo script

1. In a Go file, hover line 42 and click "+". Type "why is this goroutine not leaking?" and press Enter.
2. Answer streams under the line with "LogicLens · Copilot/<model>".
3. Ask "what happens if ctx is cancelled first?" in the same thread; the answer uses the earlier turn.
4. In the walkthrough, click **Ask** on step 2; a thread opens at its first line.
5. Click a concept chip; a thread opens with the question pre-filled.
6. Insert three lines above the thread; it moves down with its line.

## Exit check

- [ ] Demo script passes.
- [ ] Keyboard-only run of the demo works (comment widget focus and submit).
- [ ] All tests green.
