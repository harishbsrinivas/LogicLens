# 5. Ask at Any Line

Users can ask a free-text question at any line of any document and get an answer anchored to that line.

## Starting a question

- **Gutter "+"**: hovering any line shows the native comment "+" in the gutter (VS Code Comments API). Clicking it opens a thread there. The "+" appears once LogicLens has activated in the window (any LogicLens command, including Ask About This Line from the editor context menu; ADR-0030), only in trusted workspaces and for files that are not excluded.
- **Command**: "LogicLens: Ask About This Line" (palette, editor context menu, `Ctrl+Alt+E Q`) opens an empty thread with its input box at the cursor line. With a selection, the thread anchors to the selection's range.
- **From a step**: "Ask About This Step" in a step thread's title opens a thread at the step's first line, scoped to the step's range.
- **From a concept chip**: clicking a concept tag in a step opens an input box with the question pre-filled ("What is <concept>, and how is it used here?"); Enter asks it in a new thread at the step, scoped to the step's range. VS Code cannot pre-fill a comment input box, so the input box stands in for it.

## The thread

- Looks and behaves like a native code-review comment thread: inline under the line, collapsible, keyboard accessible.
- The user's question shows with their name or "You". The answer shows as "LogicLens · <provider>/<model>".
- Answers stream in. A **Stop** action cancels the request.
- Each answer can be **copied**, **regenerated**, or **deleted** (deleting removes that question and answer). Deleting the first question deletes the thread.
- **Follow-ups** in the same thread include prior turns in that thread as conversation context, up to a token budget (oldest turns dropped first, with a note).
- Answers may reference other lines ("see line 42"). Line references render as links that move the cursor.

## What the model gets

For each question:

- the question text and earlier turns in the thread,
- the anchored line or range, marked,
- the enclosing symbol, or ±40 lines if the language has no symbol provider,
- the active walkthrough's overview and the step that contains the line, if a walkthrough exists,
- the file path relative to the workspace root and the language ID.

The whole file is included only if it is under the context budget (arch §5). Privacy rules in spec §8 apply to every question.

## Lifetime

- Threads live for the editor session and survive tab switches.
- Threads follow edits: inserting lines above moves the thread down. If its line is deleted, the thread is labelled "Code changed" and collapsed, not removed.
- Up to two questions are answered at once across the window; further questions wait, shown as "Waiting…".
- Threads persist across window reloads with the walkthrough cache (spec §10) when `logiclens.cache.enabled` is on. They are stored locally only.
- "LogicLens: Clear Threads in File" and "Clear All Threads" remove them.

## Guardrails

- Questions are answered about the code. The system prompt tells the model to explain rather than rewrite, and LogicLens never applies any code the model returns; code in answers renders as read-only snippets with a copy button.
- Empty questions are not sent. Questions over 2,000 characters are refused with a message.
