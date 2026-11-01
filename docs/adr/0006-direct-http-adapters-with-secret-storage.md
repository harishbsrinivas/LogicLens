# ADR-0006: Direct HTTP adapters with keys in VS Code SecretStorage

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6, §8; arch §7

## Context
Some users have an Anthropic or OpenAI API key but none of the tools above, and some want a fully local model (Ollama). "ChatGPT" has no programmatic interface of its own; OpenAI models are reachable through Copilot, Codex sign-in, or the OpenAI API.

## Decision
Provide `anthropic`, `openai`, and `ollama` adapters using streaming HTTP. Keys are stored only in `context.secrets`. Base URL overrides are machine-scope settings. Ollama on localhost skips the data notice because code stays on the machine.

## Alternatives considered
- Keys in settings: leaks into synced settings and screenshots.
- Vendor SDK packages: larger bundle; plain `fetch` with an SSE reader is enough.

## Consequences
- Clarity holds credentials for these two providers and must never log or expose them (SECURITY.md §2).
