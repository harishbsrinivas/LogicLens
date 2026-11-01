# ADR-0003: Bring your own AI; no Clarity backend

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §1, §6, §8

## Context
Users already pay for and trust AI tools (Copilot, Claude Code, Codex, Gemini, Kiro, API keys). A Clarity-hosted model would add a data processor, accounts, billing, and operating cost.

## Decision
Clarity has no server, account, or model. It reaches models only through tools and keys the user already has, via a provider abstraction (arch §4). Clarity makes no network calls except to the user's chosen provider.

## Alternatives considered
- Hosted proxy with our own key: simpler UX for users without any AI tool, but adds cost, privacy obligations, and a backend to secure.
- Single provider (Copilot only): fewer adapters, but excludes Claude Code and Codex users and forks without Copilot.

## Consequences
- Explanation quality depends on the user's model; the evaluation set runs per provider.
- Each adapter is a maintenance cost as CLIs change; adapters are isolated and fixture-tested.
- If a provider fails, Clarity does not silently switch (ADR-0014).
