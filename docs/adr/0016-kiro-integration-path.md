# ADR-0016: Kiro integration path

- **Status:** Open (resolve in S0)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6; arch §4

## Context
Kiro is a VS Code–based IDE from AWS that installs extensions from Open VSX, and there is a Kiro CLI. It is not yet known whether Kiro exposes its models through `vscode.lm` to third-party extensions, or whether the Kiro CLI has a non-interactive mode suitable for LogicLens.

## Options
1. `vscode.lm` inside Kiro: no extra adapter if it works.
2. Kiro CLI adapter on the shared spawn helper (ADR-0005).
3. Neither works: LogicLens runs in Kiro using another provider (API key, Ollama, other CLIs); Kiro models are not supported in the MVP.

## Decision
Pending the S0 spike.

## Consequences
Spec §6 and §11 are updated with the outcome.
