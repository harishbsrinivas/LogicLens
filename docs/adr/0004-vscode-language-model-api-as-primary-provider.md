# ADR-0004: VS Code Language Model API as the primary provider

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6; arch §4

## Context
VS Code exposes `vscode.lm`, which lets an extension use chat models contributed by other extensions, chiefly GitHub Copilot (offering Claude, GPT, and Gemini families depending on plan), and any extension that registers a language model provider. VS Code handles auth and asks the user for consent.

## Decision
Build the first slice on `vscode.lm` and make it the first choice for `auto`. Feature-detect it so the extension still loads in editors that lack it.

## Alternatives considered
- Start with a CLI adapter: works without Copilot, but subprocess handling and parsing are riskier for a tracer bullet.
- Start with an HTTP adapter: needs the user to paste a key, worse first-run experience.

## Consequences
- No credentials held by LogicLens for the most common path.
- Behavior in forks (Cursor, Kiro, Windsurf) is unknown until the S0 spike.
- Consent prompts come from VS Code; LogicLens shows its own data notice first.
