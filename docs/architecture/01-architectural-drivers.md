# 1. Architectural Drivers

| Driver (source) | Consequence |
|---|---|
| No backend, no model, bring your own AI (spec §1, §6; ADR-0003) | All logic runs in the VS Code extension host. A provider abstraction hides how each AI tool is reached. No LogicLens-owned network endpoints. |
| Many heterogeneous providers: in-editor API, CLIs, HTTP (spec §6) | One small `Provider` interface that takes a prompt and yields text chunks. Anything provider-specific (flags, auth, JSON envelopes) stays inside its adapter (arch §4). |
| Providers differ in structured-output support (spec §10) | The walkthrough format must work with plain streamed text from any model. Use a line-tagged text protocol, not JSON mode or tool calls (ADR-0007). |
| Steps must stream and anchor to lines (spec §4) | Prompts number every line with its absolute file line number (ADR-0010). An incremental parser emits overview, step headers, and text deltas as they arrive. |
| Explain only; no edits (spec §1; ADR-0002) | No code path applies model output. CLIs run with tools disabled and in an isolated working directory (ADR-0005). |
| Explicit action before code leaves the machine (spec §8; ADR-0014) | All sends go through one `RequestGate` that checks trust, exclusions, data notice, and secret scan. Nothing else may call a provider. |
| Native, elegant UI (spec §7) | Explanations and questions are inline Comments API threads (ADR-0008, ADR-0028), with CodeLens rows for step titles and decorations for highlights. No webview for explanations; the settings page is the one webview (ADR-0031). Theme colors only. |
| MVP: VS Code stable on Linux only (ADR-0026). Forks (S7) and Windows and macOS (S13) after release | Linux-only Marketplace builds; no Windows- or macOS-only code before S13. Still feature-detect `vscode.lm`, never assume Copilot, and keep the engine requirement as low as the APIs allow (ADR-0017), so forks stay cheap to add in S7 (Open VSX). |
| Fast activation, small package (spec §12) | Lazy activation on commands and views only. Two small esbuild bundles (extension host, settings page script); few runtime dependencies. |
| Staleness when code changes (spec §10) | Track step and thread ranges against document edits in memory; re-anchor by text match on reopen (ADR-0019). |
