# 7. Interface and Visual Design

The interface should feel like part of VS Code: calm, legible, and fast. Elegance here means restraint, not decoration.

## Surfaces

| Surface | Used for | Why this surface |
|---|---|---|
| **Clarity panel** (webview view in the secondary side bar by default; movable) | Overview, steps, summary, provider menu, depth and audience controls | Sits beside the code so both are visible |
| **Editor decorations** | Step highlight, dimming, step number in gutter | Keeps the eye on the code |
| **Comment threads** (Comments API) | Line questions and answers | Native inline UI users know from code review |
| **Status bar item** | Current provider and model, busy indicator | Always visible, one click to switch |
| **Quick picks** | Provider and model choice, depth and audience | Native, keyboard first |
| **CodeLens** (opt-in) | "Explain" above symbols | Discoverable without menus |

No custom editors and no modal dialogs except the one-time data notice.

## Panel layout

```
┌──────────────────────────────────────┐
│ auth.ts                     ⟳  ⋯    │  header: file, refresh, menu
│ Standard ▾  Practitioner ▾  Copilot ▾│  controls (compact chips)
├──────────────────────────────────────┤
│ Handles sign-in and session refresh  │  overview
│ for the web app...                   │
├──────────────────────────────────────┤
│ ● 1  Load config          L1–14      │  step list; focused step
│      Reads OAuth client settings...  │  expanded, others collapsed
│      [async/await] [env vars]   Ask  │
│ ○ 2  Build the auth URL     L16–31   │
│ ○ 3  Handle the callback    L33–70   │
│ ◌ 4  …streaming                      │
├──────────────────────────────────────┤
│ Summary · Things to watch            │
├──────────────────────────────────────┤
│ Copilot · claude-sonnet · 4.2s · 3.1k│  footer
└──────────────────────────────────────┘
```

- One focused step is expanded; others show title and line range only. A "Show all" toggle expands every step for skimming.
- A thin progress line under the header shows streaming progress; there is no spinner over content.
- Empty state: file name, one line of copy, an **Explain this file** button, and the current provider.
- Setup state (no provider ready): a short list of providers with their state and one action each.

## Visual language

- **Theme-native.** All color comes from VS Code theme variables (`--vscode-*`). No hardcoded colors. Works in light, dark, and high-contrast themes.
- **Typography.** Panel text uses the workbench font and size; code and line ranges use the editor font. Two weights only.
- **Spacing.** 4-pixel grid. Generous vertical rhythm between steps; tight within a step.
- **Iconography.** Codicons only, so icons match the workbench.
- **Highlight.** Focused range uses the editor's selection-highlight background at low opacity with a 2-pixel left border in the focus-border color. Dimming lowers text opacity outside the range to about 70%.
- **Motion.** Short, purposeful transitions (150 ms) for step expand and highlight changes. Respect the OS reduced-motion preference and VS Code's `workbench.reduceMotion`.

## Accessibility

- Every action reachable by keyboard; visible focus rings using `--vscode-focusBorder`.
- The step list is a list with proper roles; the focused step is announced by screen readers ("Step 2 of 6, Build the auth URL, lines 16 to 31").
- Streaming text uses a polite live region that announces when a step finishes, not every token.
- Contrast meets WCAG 2.2 AA in the default light, dark, and high-contrast themes.
- Highlighting never relies on color alone: the gutter step number and the left border carry the same information.

## Copy and tone

- Short, plain labels: "Explain file", "Ask", "Refresh", "Stop".
- Errors say what happened and the one thing to do next.
- The provider label is always visible on generated content.
