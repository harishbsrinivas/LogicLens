# ADR-0015: Deliver in thin vertical slices

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** docs/plan/README.md

## Context
The riskiest parts (model integration, anchoring, webview streaming) cut across every layer. Building layer by layer would delay finding out whether they work together.

## Decision
Deliver S0 (preflight and spike) then S1–S9, each a demoable end-to-end increment with tests and doc updates. S1 is a tracer bullet through the whole stack with one provider. Privacy controls land with the first slice that sends code.

## Alternatives considered
- Horizontal layers (all providers first, then UI): nothing usable until late.

## Consequences
- Each slice has a demo script and an exit check in its plan file.
- Some early code is replaced later (for example S4's simple range shift, replaced in S8). Accepted cost.
