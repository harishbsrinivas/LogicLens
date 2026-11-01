# ADR-0013: No telemetry in the MVP

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §8, §12

## Context
The product handles source code; trust is central. Telemetry needs a privacy notice, a processor, and care to avoid leaking paths or code.

## Decision
Ship no telemetry. Success is measured from Marketplace signals, issues, and an opt-in feedback control that opens a prefilled issue only when the user clicks.

## Alternatives considered
- Anonymous usage counts respecting `isTelemetryEnabled`: useful for provider mix, but not worth the trust cost before launch.

## Consequences
- Less product insight; revisit with a new ADR after MVP.
