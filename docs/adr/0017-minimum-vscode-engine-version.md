# ADR-0017: Minimum VS Code engine version

- **Status:** Proposed (S0; accept once `vscode.lm` is verified with Copilot)
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

S0 evidence: the skeleton activates and its command runs in VS Code 1.90.0. Not yet verified: `vscode.lm` model listing, streaming, consent, and error codes at 1.90 with Copilot signed in, and which forks ship at or above 1.90.

## Consequences
Sets `engines.vscode` and `@types/vscode` and the Node target for esbuild.
