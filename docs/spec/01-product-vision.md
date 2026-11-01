# 1. Product Vision

## Purpose

Reading unfamiliar code is slow. Developers jump between files, guess at intent, and paste snippets into a chat window that has no idea where the code lives. LogicLens explains code where it sits: it walks through a file or selection step by step, highlights each step in the editor as you go, and lets you ask a question at any line and get an answer anchored to that line.

## Positioning

- **Reading, not writing.** LogicLens explains. It never edits code, generates code, or runs commands. That keeps it safe to point at any file and keeps its interface focused.
- **Bring your own AI.** LogicLens has no model and no account of its own. It uses the AI assistant the user already has and already trusts: GitHub Copilot through the VS Code Language Model API (which also exposes Claude, GPT, and Gemini models to Copilot users), or Claude Code. The first release supports these two; OpenAI Codex, Gemini CLI, Kiro, a local Ollama model, and Anthropic or OpenAI API keys follow after release (spec §6). No new subscription, no new data processor.
- **Anchored to the code.** Every step and every answer points at specific lines. The editor is the primary surface; the panel is a guide beside it.
- **Elegant and quiet.** Native look, follows the user's theme, no clutter, no chat-window sprawl (spec §7).

## Name

**LogicLens** (ADR-0018; it replaced the working name "Clarity", which collided with Microsoft Clarity). The publisher ID and a formal trademark check are still due before the first public release (arch §10, open decision 1).

## Product boundary

In scope: explaining code the user points to, answering questions about it, and doing so through AI providers the user already has.

Out of scope: code generation, refactoring, applying fixes, running or debugging code, hosting a model, user accounts, a backend service, and team or cloud features (spec §11).

## Principles

1. **Explicit action before any code leaves the machine.** Nothing is sent on file open or in the background (spec §8).
2. **Native first.** Use VS Code's own surfaces (Comments API, decorations, CodeLens, theme colors, quick picks) before custom UI.
3. **Progressive.** Show something useful fast: stream the overview, then fill in steps.
4. **Honest.** Say which provider and model produced an explanation. Say when an explanation is stale because the code changed. Say when the model's answer could not be anchored to lines.
5. **Small footprint.** No backend, minimal dependencies, no telemetry in the MVP.
