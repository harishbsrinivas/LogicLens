# ADR-0029: Step threads sit just above their code

- **Status:** Accepted (implemented in S2)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §4, §7; arch §6; plan S2. Amends the step placement in ADR-0028.

## Context
ADR-0028 put each step's thread "under its first line". The project owner wants each explanation at the beginning of the code block it explains. VS Code draws a comment thread below the line it is attached to; there is no option to draw it above.

## Decision
A step's thread is attached to the line before the step's first line, so it appears between the previous code and the step, directly above the code it explains. A step that starts at line 1 cannot have anything above it, so its thread is attached to line 1 and appears below it. The step's title CodeLens is on the step's first line, so title and explanation sit together above the code.

The overview thread stays at line 1.

## Alternatives considered
- Under the step's first line (ADR-0028 as written): splits the first line, often a function signature, from the rest of its block.
- Above the step via a CodeLens only: one line of plain text, no Markdown body.

## Consequences
- The thread is attached to a line that belongs to the previous step or to code outside any step. Range tracking (S8) moves it with the step's start, not with that line's content.
- For steps starting at line 1 the overview and that step share line 1; both threads show, overview first.
