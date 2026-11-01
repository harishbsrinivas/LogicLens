# 7. Interface and Visual Design

The interface should feel like part of VS Code: calm, legible, and fast. Elegance here means restraint, not decoration.

## Surfaces

Explanations appear over the code, inline in the editor. There is no LogicLens panel (ADR-0028).

| Surface | Used for | Why this surface |
|---|---|---|
| **Inline explanation threads** (Comments API, read-only) | The file's explanation (S1), then overview, summary, and things to watch at the top of the file; one block per step under its first line (S2); bookmarked explanations (S11) | Sits in the code, between the lines it explains |
| **Question threads** (Comments API) | Line questions and answers | Native inline UI users know from code review |
| **CodeLens rows** | Step titles with Previous and Next (S2); trail breadcrumbs (S10); opt-in "Explain" above symbols | One clickable line above the code, keyboard reachable |
| **Editor decorations** | Step highlight, dimming, step number, bookmark and withheld-line icons in gutter | Keeps the eye on the code |
| **Bookmarks view** (tree view in the LogicLens container) | Saved steps, answers, and code ranges (spec §14) | Native tree: keyboard, search, and screen reader support for free |
| **Status bar item** | Current provider and model, busy indicator, no-provider warning | Always visible, one click to switch |
| **Quick picks** | Provider and model choice, depth, audience, jargon, personality, long trails | Native, keyboard first |

No webviews, no custom editors, and no modal dialogs except the terms prompt and the one-time data notice.

## Inline layout

```
   ┌ ● auth.ts                                       ⟳  ✕ ┐  thread title: file, status,
   │ LogicLens · Copilot · gpt-4.1 · 4.2s               │  actions (Stop / Explain again,
1  │ Handles sign-in and session refresh for the web    │  Close)
   │ app…  (overview; summary added when finished)      │  header line: provider · model
   └────────────────────────────────────────────────────┘  · duration
1  import { config } from './config';
   ...
   2 · Build the auth URL  L16–31   ‹ Previous  Next ›      step title row (CodeLens)
16 export function authUrl() {
   ┌ Step 2 of 6 ─────────────────────────────────────── ┐  focused step: expanded
   │ Builds the OAuth URL from the client settings…      │
   │ `async/await`  `env vars`                     Ask   │
   └─────────────────────────────────────────────────────┘
17   const params = new URLSearchParams({
   ...
   3 · Handle the callback  L33–70  ‹ Previous  Next ›      other steps: title row only
```

- The file's thread is anchored at line 1, expanded when an explanation starts, and the editor scrolls to it. It can be collapsed like any comment thread and closed with **Close Explanation**.
- While streaming, the thread title says "Explaining <file>…" and offers **Stop**. When finished, it offers **Explain again**. Stopped and failed explanations say so in the title and at the end of the text.
- One step block is expanded at a time; **Show all** in the overview thread's title expands every step for skimming (S2).
- Settings that affect the current walkthrough (depth, audience, jargon, provider, personality) are title actions on the overview thread that open quick picks.
- With no provider ready (S5), a notification opens the provider picker and the status bar item shows a warning.

## Rendering model output

Explanations are Markdown rendered by VS Code itself, with HTML, command links, and theme icons off. Images are shown as links and never loaded; links other than http(s) are shown as plain text (arch §8).

## Visual language

- **Theme-native.** All color comes from the VS Code theme: native comment and CodeLens styling, and theme colors for decorations. No hardcoded colors except the gutter icons' light and dark variants (arch §6). Works in light, dark, and high-contrast themes.
- **Typography.** Inline explanations use VS Code's comment typography; code and line ranges use the editor font.
- **Iconography.** Codicons only, so icons match the workbench.
- **Highlight.** Focused range uses the editor's selection-highlight background at low opacity with a 2-pixel left border in the focus-border color. Dimming lowers text opacity outside the range to about 70%.
- **Motion.** None of LogicLens's own; expanding and collapsing threads follows VS Code, including `workbench.reduceMotion`.

## Accessibility

- Every action reachable by keyboard: commands with default keys, thread title actions, and CodeLens rows all work without a mouse.
- Explanations are native comment threads, so VS Code's comment navigation and Accessible View (Alt+F2) read them.
- Focusing a step is announced by screen readers ("Step 2 of 6, Build the auth URL, lines 16 to 31"); S2 confirms the mechanism (ADR-0028).
- Streaming does not announce every token; finishing or failing is announced once.
- Contrast meets WCAG 2.2 AA in the default light, dark, and high-contrast themes.
- Highlighting never relies on color alone: the gutter step number and the left border carry the same information.

## Copy and tone

- Short, plain labels: "Explain file", "Ask", "Refresh", "Stop".
- Errors say what happened and the one thing to do next.
- The provider label is always visible on generated content.
