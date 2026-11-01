# 2. Users and Core Journeys

## Personas

- **Newcomer.** Joined a team or an open-source project last week. Needs the "what and why" of a file before touching it. Values plain language and the big picture.
- **Reviewer.** Reads a colleague's change or a dependency's source. Needs to confirm what a tricky block does, quickly, without leaving the editor.
- **Maintainer.** Owns old code with no docs. Needs to reconstruct intent, side effects, and edge cases. Values precision over hand-holding.
- **Learner.** Studying a language or framework by reading real code. Needs concepts named and explained (closures, generics, async flow) at the point they appear.

Each persona maps to an explanation **audience** setting (spec §4): newcomer and learner to `newcomer`, reviewer to `practitioner`, maintainer to `expert`. Learners who are new to programming itself, or non-developers such as product managers, use `eli5`.

## Core journeys

### J1. Walk through a file

1. User opens a file, or right-clicks it in the Explorer, and runs **LogicLens: Explain File**.
2. On first use, LogicLens asks the user to accept its terms of use (spec §8). If no provider is configured, it offers the detected ones (spec §6) and the one-time data notice (spec §8).
3. The LogicLens panel opens beside the editor. A one-paragraph overview streams in within a few seconds.
4. Steps appear as they arrive. Each step has a title, a line range, and an explanation.
5. Selecting a step, or pressing the next-step key, scrolls the editor to its lines and highlights them. Other lines dim slightly.
6. User reaches the last step and sees a short summary with key takeaways.

### J2. Explain a selection

1. User selects a block and runs **LogicLens: Explain Selection** from the context menu or a key.
2. Same walkthrough, scoped to the selection, with the rest of the file sent as context (spec §8 limits apply).

### J3. Ask a question at a line

1. User hovers a line and clicks the LogicLens "+" in the gutter, or puts the cursor on a line and runs **LogicLens: Ask About This Line**.
2. An inline thread opens under that line with a text box.
3. User types "why is this awaited inside the loop?" and presses Enter.
4. The answer streams into the thread, anchored to that line. Follow-up questions in the same thread keep the conversation context.
5. Threads stay attached to their lines while the session is open and move with edits.

### J4. Ask about a step

1. While reading a step in the panel, user clicks **Ask** on that step.
2. A thread opens at the step's first line, pre-scoped to the step's range and explanation.

### J5. Switch AI provider

1. User clicks the LogicLens status bar item, which shows the current provider and model.
2. A quick pick lists available providers with their state (ready, needs sign-in, not installed).
3. User picks one. The next request uses it. Existing explanations keep their original provider label.

### J6. Return to a file

1. User reopens a file explained earlier.
2. LogicLens offers the cached walkthrough without a new request. If the file changed, it marks the walkthrough stale, keeps steps whose code is unchanged, and offers **Refresh** (spec §10).

### J7. Follow code across files

1. While reading step 3 of `app.ts`, the user puts the cursor on `verifyUser` and runs **LogicLens: Follow to Definition**.
2. `auth.ts` opens at `verifyUser`. The panel breadcrumbs read `app.ts › handleRequest › auth.ts › verifyUser`.
3. User explains the symbol, follows one more call into `token.ts`, then clicks the `app.ts` crumb.
4. `app.ts` reopens with step 3 focused, exactly where they left (spec §13).

### J8. Bookmark and return

1. User finds a step that explains a subtle retry rule and clicks its bookmark icon, adding the note "retry rule for billing".
2. Days later, they open the Bookmarks view, select the note, and land on those lines with the saved explanation shown, even though the walkthrough was since refreshed (spec §14).

## Non-journeys for the MVP

Explaining a whole folder or repository, explaining a diff or pull request, sharing explanations with teammates, and exporting to docs are post-MVP candidates (spec §11).
