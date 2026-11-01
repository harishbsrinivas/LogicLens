# ADR-0030: Keep lazy activation; the gutter "+" appears after first use

- **Status:** Accepted (S4)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §5; arch §3, §10 (open decision 4); plan S4

## Context
Questions start from the native comment "+" in the gutter (ADR-0008). VS Code shows it only for documents a registered `CommentController` offers commenting ranges for, and LogicLens registers its controller in `activate`. Activation is lazy (commands only, DEVELOPMENT.md §5), so in a fresh window the "+" is missing until the first LogicLens command runs. Activating on `onLanguage` for every language would show it at once, but there is no wildcard `onLanguage`; it would mean listing every language, or `*`/`onStartupFinished`, which the project rules forbid. The bundle is about 190 KB and activation does no I/O beyond reading settings, so cost is small but not zero, and it is paid in every window whether or not LogicLens is used.

## Decision
Keep lazy activation. The gutter "+" appears once LogicLens has activated in the window. "LogicLens: Ask About This Line" is contributed to the editor context menu and bound to `Ctrl+Alt+E Q`; both are static contributions that work before activation and activate the extension, so the first question never needs the "+".

## Alternatives considered
- `onLanguage:<id>` for a long list of languages: activation in nearly every window, a list to maintain, and still misses unlisted languages.
- `onStartupFinished`: activates in every window; forbidden by DEVELOPMENT.md §5.

## Consequences
- The README and demo script say to use the context menu or the keybinding for the first question in a window.
- Revisit if user feedback shows the missing "+" is confusing; the change is a one-line `activationEvents` entry.
