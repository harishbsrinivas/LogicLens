# 10. Open Decisions

1. **Publisher ID and trademark check.** Name chosen: LogicLens (ADR-0018). Register the publisher ID and run a formal Marketplace and trademark search before S9 (Open VSX search before S7, ADR-0026).
2. **Kiro integration path.** `vscode.lm` inside Kiro, Kiro CLI, or neither. Deferred to S7, after release (ADR-0016, ADR-0025).
3. **Minimum VS Code engine version.** Lowest version with the Language Model API features we need, Fork compatibility no longer constrains it in the MVP (ADR-0026). Resolve in S0 (ADR-0017).
4. **Earlier activation for the gutter "+".** Activating on `onLanguage` for all languages makes threads available immediately but costs activation on every window. Decide in S4 after measuring activation time.
5. **Syntax highlighting of code snippets inside answers.** Options: none (monospace only), a small highlighter, or Shiki with the user's theme colors mapped from CSS variables. Decide in S9 based on bundle size.
6. **OpenAI API flavor.** Responses API vs Chat Completions for the `openai` adapter. Decide in S7 (after release).
7. **Chat participant (`@logiclens`).** Post-MVP; would reuse the pipeline. Decide after MVP.
