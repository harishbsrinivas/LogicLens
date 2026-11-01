# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** Session, 2026-11-01

## Context
Spec and architecture describe the design but not why each choice was made or which choices are provisional. AI agents and new contributors may reverse decisions unknowingly.

## Decision
Keep one ADR per file under `docs/adr/`, indexed by status and tag in `docs/adr/README.md`. Spec, architecture, and plan are split into numbered per-section files with an index each, following the layout used in the comprehend project.

## Alternatives considered
- A single decision-log file: simpler at first, but the comprehend project had to split it later (its ADR-0041).
- Commit messages only: reasoning scattered and hard to find.

## Consequences
- `AGENTS.md` requires an ADR for hard-to-reverse or cross-cutting decisions.
- Records are superseded, never rewritten.
