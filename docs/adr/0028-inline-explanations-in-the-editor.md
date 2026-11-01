# ADR-0028: Explanations inline in the editor; no side panel

- **Status:** Accepted (implemented in S1; step placement amended by ADR-0029)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §4, §7; arch §6; plan S1, S2. Supersedes ADR-0009.

## Context
ADR-0009 put the walkthrough in a webview panel beside the editor. In use, the project owner wants the explanation over the code itself, not in a separate panel, so the eye stays on one surface.

VS Code gives extensions no free-floating overlay on a text editor. The options are:

- Webview editor insets (`window.createWebviewTextEditorInset`): a proposed API. Extensions that use proposed APIs cannot be published to the Marketplace (ADR-0026).
- Comment threads (Comments API, already used for questions by ADR-0008): a stable API that renders a Markdown block between code lines, can be expanded or collapsed, and carries title actions.
- Hovers: Markdown, but gone when the pointer moves, and no keyboard path to read a whole walkthrough.
- CodeLens and `before`/`after` decoration text: one line of plain text. Good for titles, too small for explanations.

## Decision
Explanations render inline in the editor, built only from stable APIs:

- Each walkthrough is shown as read-only comment threads from one `CommentController` (`logiclens`). The file-level thread (S1: the whole Markdown explanation; from S2: overview, then summary and things to watch) is anchored at the first line. From S2 each step gets its own thread under its first line; the focused step is expanded and the rest collapsed.
- From S2 a CodeLens row above each step's first line shows its number and title and focuses it on click.
- Thread title actions replace panel buttons: Stop while streaming, Explain again when finished, Close.
- Model output is set as a `MarkdownString` with `isTrusted`, `supportHtml`, and `supportThemeIcons` off, after a local pass that turns images into links and drops links that are not http(s) (arch §8).
- There is no webview. Controls that lived in the panel header move to the status bar, quick picks, and thread title actions.

## Alternatives considered
- Keep the panel as an optional view: two surfaces to keep in sync, and the owner does not want a panel.
- Webview insets: proposed API; cannot ship on the Marketplace.
- Hover-only explanations: transient and hard to read by keyboard or screen reader.
- Ghost text only: no Markdown or multi-line text.

## Consequences
- Svelte, Vite, markdown-it, and DOMPurify are removed. The VSIX ships no webview, CSP, or message bridge, which removes a whole class of XSS and message-spoofing risk. VS Code's own Markdown renderer does the rendering.
- Comment threads look like code-review comments (author row, thread label) and also appear in VS Code's Comments view. Accepted as the cost of a native inline surface.
- Layout is limited to what threads and CodeLens can show. Clickable breadcrumbs (S10) and header chips (S3, S12) become CodeLens rows and quick picks; their slices confirm the details.
- Questions (S4) and walkthrough threads share one controller; thread `contextValue` tells them apart for menus.
- Screen reader announcements cannot use a webview live region; S2 must confirm step announcements through VS Code's comment and accessible-view support.
