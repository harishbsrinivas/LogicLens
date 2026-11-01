# ADR-0009: Single webview view panel built with Svelte 5

- **Status:** Proposed (confirm in S1)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §7; arch §6

## Context
The walkthrough needs a rich, streaming, accessible list beside the editor. Tree views cannot render Markdown bodies. The Microsoft Webview UI Toolkit is deprecated. The project owner already uses Svelte.

## Decision
One `WebviewView` in a LogicLens view container, preferring the secondary side bar. UI written in Svelte 5, built by Vite into one JS and one CSS file. Styling only from `--vscode-*` variables and codicons. Markdown rendered with HTML disabled, then sanitized.

## Alternatives considered
- Plain DOM code: no dependency, but streaming list updates and keyboard handling get messy.
- React: larger runtime for no gain here.
- Webview panel (editor tab): competes with code for space.

## Consequences
- Small runtime; compiled output.
- Webview state is rebuilt from the host on show (`retainContextWhenHidden: false`).
