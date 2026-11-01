# ADR-0002: Explain only; never edit or run code

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §1, §11

## Context
AI coding tools commonly generate and apply code. Clarity's purpose is understanding. Allowing edits widens the security surface (model output acting on the workspace) and blurs the interface.

## Decision
Clarity only reads code and shows explanations. No code path applies model output to a document, runs commands, or executes code. CLI providers run with tools disabled (ADR-0005).

## Alternatives considered
- "Apply suggested fix" buttons: useful, but turns prompt injection in code into a write path, and duplicates what the user's AI assistant already does.

## Consequences
- Prompt injection inside explained code can only change displayed text.
- Feature requests for edits are out of scope; users are pointed to their assistant.
