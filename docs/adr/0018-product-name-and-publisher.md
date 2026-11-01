# ADR-0018: Product name and publisher ID

- **Status:** Accepted (name); publisher ID and formal trademark check before S9
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §1

## Context
The working name "Clarity" collides with Microsoft Clarity, an existing analytics product, which risks Marketplace confusion and trademark issues. Command and setting prefixes carry the name, so changing it after the first release would mean migrating user settings.

## Decision
The product is named **LogicLens**. Identifiers follow the name before any release:

- Display name and command category: `LogicLens`.
- Extension `name`: `logiclens`; placeholder publisher ID: `logiclens-dev`.
- Command, setting, context-key, and secret prefixes: `logiclens.` (lowercase, like `gitlens.`).
- Ignore file: `.logiclensignore`.

A web search on 2026-11-01 found no VS Code extension or registered trademark named LogicLens; the closest match was an unrelated Claude Code skill called "Logic Lens". That is not a clearance. Before S9, search the VS Code Marketplace, Open VSX, and the USPTO and EUIPO databases, and register the final publisher ID.

## Alternatives considered
- Keep "Clarity" with a qualifier (for example "Clarity: Code Explainer"): still confusable with Microsoft Clarity.

## Consequences
- Rename done in S0, before any user has settings to migrate.
- If the S9 check finds a conflict, a new ADR supersedes this one, and the rename must still land before the first release.
