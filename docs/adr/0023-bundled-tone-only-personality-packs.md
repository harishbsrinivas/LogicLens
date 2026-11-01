# ADR-0023: Bundled, tone-only personality packs

- **Status:** Proposed (S12)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §15; arch §5

## Context
Some users want explanations in a distinct voice (patient teacher, skater, sarcastic, and so on). A voice instruction in the prompt can degrade structure and accuracy, and user-written instructions would put arbitrary text into the system prompt.

## Decision
- A personality pack is a versioned prompt fragment in `src/prompts/personalities/`, with an ID, display name, description, and sample sentence. Five packs ship: `patient-teacher`, `skater`, `sarcastic`, `noir-detective`, `sports-commentator`; `none` is the default.
- The fragment is appended after the quality rules and output protocol, and the system prompt states that protocol, ranges, facts, audience, and jargon rules take precedence over voice.
- Pack ID and pack version are part of the cache key.
- Packs apply to model text only; UI copy is never styled.
- Each pack must pass the evaluation gate in spec §15 before it ships.
- No user-defined packs in this release.

## Alternatives considered
- Free-text "custom voice" setting: flexible, but puts arbitrary text into the system prompt and cannot be evaluated; left as a post-MVP candidate needing its own ADR.
- Post-process neutral output into a voice with a second request: doubles cost and latency, and the rewrite can change facts.
- Personality as an audience value: couples tone to technical level; users want both independently.

## Consequences
- Five more prompt variants to snapshot-test and evaluate per release.
- Cache entries multiply by pack; acceptable under the 50 MB cap.
