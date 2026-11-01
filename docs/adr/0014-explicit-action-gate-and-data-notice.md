# ADR-0014: Single request gate; explicit action, data notice, no silent fallback

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6, §8; arch §8; SECURITY.md §1

## Context
Sending code to a third party must be intentional and visible. Multiple entry points and providers make it easy for a new path to bypass checks.

## Decision
All provider calls go through `RequestGate.send()`, which enforces in order: trusted workspace, not excluded, size limit, per-provider data notice acknowledged, secret scan resolved. Requests start only from explicit user actions. If a provider fails, LogicLens offers a fix and never switches to another provider on its own. A lint rule prevents importing providers outside the gate.

## Alternatives considered
- Checks in each command: easy to forget in new paths.
- Automatic fallback to the next ready provider: convenient, but silently changes where code goes.

## Consequences
- One place to audit and test; an integration test asserts no request on open, switch, edit, or save.
