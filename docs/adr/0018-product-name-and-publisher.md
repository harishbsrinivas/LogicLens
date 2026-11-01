# ADR-0018: Product name and publisher ID

- **Status:** Open (resolve before S9)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §1

## Context
The working name "Clarity" collides with Microsoft Clarity, an existing analytics product, which risks Marketplace confusion and trademark issues.

## Options
1. Keep "Clarity" with a qualifier in the display name (for example "Clarity: Code Explainer").
2. Choose a different name.

## Decision
Pending a Marketplace, Open VSX, and trademark check. Command and setting prefixes (`clarity.`) change with the name if needed; do that before S9 to avoid migrating user settings.

## Consequences
Rename touches `package.json`, docs, and command IDs.
