# ADR-0021: Navigation trail built from an explicit Follow command

- **Status:** Accepted (implemented in S10)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §13; arch §3, §6, §7

## Context
Users follow calls into other files and lose their place. A breadcrumb trail needs to know which editor switches were "follow this definition" jumps. VS Code has no event that says a definition navigation happened; Go to Definition, Peek, Ctrl+click, tab clicks, and Quick Open all look the same from `onDidChangeActiveTextEditor`.

## Decision
- LogicLens records a trail entry only through its own **Follow to Definition** command, which calls `vscode.executeDefinitionProvider`, opens the result, and pushes an entry.
- Entries store URI, symbol name, position, focused step index, and scroll position. No code text.
- The trail is linear (browser-style history), capped at 30 entries, one per window, persisted in `workspaceState`.
- Following never sends anything to a provider. Explaining the destination is a separate explicit action.

## Alternatives considered
- Infer jumps from editor switches with timing heuristics: unreliable; a trail that records some jumps and not others erodes trust.
- Wrap or override `editor.action.revealDefinition`: intrusive, breaks other extensions' expectations and user keybindings.
- Tree-shaped trail keeping every branch: more complete, but harder to show as breadcrumbs and harder to move through with two keys.
- Include definition source in the prompt automatically: changes what leaves the machine; stays the separate post-MVP cross-file-context candidate.

## Consequences
- Users must use LogicLens's command (or its keybinding) to build the trail; native F12 is not captured. Documented in spec §13 and the README.
- No new data leaves the machine.
