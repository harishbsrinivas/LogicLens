# ADR-0010: Number every line with its absolute file line number in prompts

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §4; arch §5

## Context
Models are unreliable at counting lines. Steps and answers must reference exact lines, and selections are part of larger files.

## Decision
Prefix each sent line with its 1-based line number in the file (padded, with a separator). Use the same absolute numbers for selections and context; mark the target with explicit markers. Ranges in responses use these numbers.

## Alternatives considered
- Relative numbers per selection: requires remapping and invites off-by-N errors.
- No numbers, match by quoted text: fragile with repeated lines.

## Consequences
- Small token overhead (about 5–8%).
- Anchor rate is measurable and is an MVP target.
