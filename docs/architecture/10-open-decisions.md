# 10. Open Decisions

1. **Product name and publisher ID.** "Clarity" collides with Microsoft Clarity. Check Marketplace and trademark before S9 (ADR-0018).
2. **Kiro integration path.** `vscode.lm` inside Kiro, Kiro CLI, or neither. Resolve in S0 (ADR-0016).
3. **Minimum VS Code engine version.** Lowest version with the Language Model API features we need, balanced against fork compatibility. Resolve in S0 (ADR-0017).
4. **Earlier activation for the gutter "+".** Activating on `onLanguage` for all languages makes threads available immediately but costs activation on every window. Decide in S4 after measuring activation time.
5. **Syntax highlighting of code snippets inside answers.** Options: none (monospace only), a small highlighter, or Shiki with the user's theme colors mapped from CSS variables. Decide in S9 based on bundle size.
6. **OpenAI API flavor.** Responses API vs Chat Completions for the `openai` adapter. Decide in S7.
7. **Chat participant (`@clarity`).** Post-MVP; would reuse the pipeline. Decide after MVP.
