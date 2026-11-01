# ADR-0008: Use the VS Code Comments API for line questions

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §5, §7; arch §6

## Context
Users must be able to ask a question at any line and see the answer next to it. Options are a custom inline widget (not available to extensions), a hover, the side panel, or the Comments API used by code review extensions.

## Decision
Register a `CommentController` with commenting ranges covering every line of eligible documents. Questions and streamed answers are comments in a thread anchored to the line.

## Alternatives considered
- Answers in the side panel only: breaks the "anchored at the line" requirement.
- Hover provider: no text input, disappears on mouse move.
- Inline chat: reserved for the built-in chat; no general extension API for custom inline input.

## Consequences
- Native look, keyboard support, and collapse behavior come for free.
- If another extension provides commenting ranges, VS Code shows a picker when clicking "+". Documented.
- The "+" appears only after LogicLens activates (arch §10, decision 4).
