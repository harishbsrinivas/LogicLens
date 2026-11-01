# ADR-0012: Publish to the VS Code Marketplace and Open VSX

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §11, §12; arch §9

## Context
Kiro, Cursor, Windsurf, VSCodium, and Gitpod install extensions from Open VSX, not the Microsoft Marketplace. The user explicitly wants Kiro-adjacent support.

## Decision
Publish every release to both registries from CI on tag.

## Alternatives considered
- Marketplace only: excludes fork users.

## Consequences
- Two publish tokens in CI secrets.
- Fork compatibility is part of the release matrix, best effort for providers each fork exposes.
