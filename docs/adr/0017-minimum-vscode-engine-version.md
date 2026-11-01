# ADR-0017: Minimum VS Code engine version

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** arch §1, §9

## Context
The Language Model API and its error types, the Comments API features we use, and the secondary side bar placement arrived in different releases. Forks often lag behind VS Code stable, so a high engine requirement blocks installation there.

## Options
1. Require a recent version with every API we want.
2. Require the lowest version that has `vscode.lm` basics and feature-detect the rest.

## Decision
Option 2: `engines.vscode` `^1.90.0`, the first stable release with the Language Model API, with `@types/vscode` pinned to `1.90.0` so newer APIs fail to typecheck and must be feature-detected. esbuild targets `node20`. Integration tests run against 1.90.0.

S0 evidence: the S1 integration suite passes on VS Code 1.90.0 and 1.144.0. The `vscode-lm` adapter streams from Copilot Free on 1.142. Copilot Chat itself now ships inside VS Code and requires `^1.142.0`, so Copilot users run 1.142 or later anyway; on older versions LogicLens installs and reports that no models are available. Forks no longer constrain the floor in the MVP (ADR-0026). Raising the floor later is cheap and needs a new ADR.

## Consequences
Sets `engines.vscode` and `@types/vscode` and the Node target for esbuild.
