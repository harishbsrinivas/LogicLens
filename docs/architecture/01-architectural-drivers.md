# 1. Architectural Drivers

| Driver (source) | Consequence |
|---|---|
| No backend, no model, bring your own AI (spec §1, §6; ADR-0003) | All logic runs in the VS Code extension host. A provider abstraction hides how each AI tool is reached. No LogicLens-owned network endpoints. |
| Many heterogeneous providers: in-editor API, CLIs, HTTP (spec §6) | One small `Provider` interface that takes a prompt and yields text chunks. Anything provider-specific (flags, auth, JSON envelopes) stays inside its adapter (arch §4). |
| Providers differ in structured-output support (spec §10) | The walkthrough format must work with plain streamed text from any model. Use a line-tagged text protocol, not JSON mode or tool calls (ADR-0007). |
| Steps must stream and anchor to lines (spec §4) | Prompts number every line with its absolute file line number (ADR-0010). An incremental parser emits overview, step headers, and text deltas as they arrive. |
| Explain only; no edits (spec §1; ADR-0002) | No code path applies model output. CLIs run with tools disabled and in an isolated working directory (ADR-0005). |
| Explicit action before code leaves the machine (spec §8; ADR-0014) | All sends go through one `RequestGate` that checks trust, exclusions, data notice, and secret scan. Nothing else may call a provider. |
| Native, elegant UI (spec §7) | Use Comments API for threads (ADR-0008), decorations for highlights, a single webview view for the panel (ADR-0009). Theme variables only. |
| Works in VS Code forks (Cursor, Kiro, Windsurf, VSCodium) where possible (spec §6) | Publish to Open VSX too (ADR-0012). Feature-detect `vscode.lm`; never assume Copilot. Keep the engine requirement as low as the APIs allow (ADR-0017). |
| Fast activation, small package (spec §12) | Lazy activation on commands and views only. esbuild bundle; webview built separately; few runtime dependencies. |
| Staleness when code changes (spec §10) | Track step and thread ranges against document edits in memory; re-anchor by text match on reopen (ADR-0019). |
