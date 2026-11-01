# ADR-0005: Use provider CLIs headless, tools disabled, in an isolated directory

- **Status:** Proposed (confirm flags in S0)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §6; arch §4, §8

## Context
Claude Code, Codex, Gemini CLI, and possibly Kiro offer non-interactive modes that use the user's existing sign-in. They are agents: by default they can read files, edit files, and run commands. Clarity needs only text generation.

## Decision
Spawn each CLI with an argument array and `shell: false`; send the prompt on stdin; request a streaming machine-readable output format; disable tools or use the most restrictive permission and sandbox mode; run in an empty directory under the extension's global storage with a minimal environment; enforce timeout, output cap, and kill on cancel. A CLI that cannot be restricted is labeled "agentic", excluded from `auto`, and disclosed in its data notice.

## Alternatives considered
- Run in the workspace folder so the CLI can read more context: better answers, but the CLI could read and send files the user did not pick, and could modify the workspace.
- Drive the CLIs' own VS Code extensions: no stable public API for that.
- Use vendor SDKs directly: requires API keys, losing the subscription sign-in users already have.

## Consequences
- Answers use only the context Clarity sends.
- Each CLI's flags are verified in S0 and pinned in arch §4; adapter tests use recorded output to catch format changes.
- S0 evidence so far: Claude Code (2.1.312) runs headless with all tools and MCP servers off in an empty directory, confirmed by its init line (`tools: []`, `mcp_servers: []`); invocation in arch §4. Codex, Gemini CLI, and Kiro are still unverified, so this stays Proposed.
