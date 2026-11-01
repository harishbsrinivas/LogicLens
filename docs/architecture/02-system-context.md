# 2. System Context

```
                     ┌──────────────────────────── user's machine ────────────────────────────┐
                     │                                                                        │
   developer ───────►│  VS Code (or compatible editor)                                        │
                     │  ┌──────────────────────────────────────────────────────────────────┐  │
                     │  │ LogicLens extension host code                                      │  │
                     │  │  commands · RequestGate · explain pipeline · providers · state   │  │
                     │  └──────┬──────────────┬───────────────┬──────────────┬─────────_───┘  │
                     │         │ postMessage  │ Comments API  │ vscode.lm    │ spawn (stdin)  │
                     │  ┌──────▼─────┐  ┌─────▼──────┐  ┌─────▼────────┐  ┌──▼────────────┐   │
                     │  │ Panel      │  │ Editor     │  │ Other ext.   │  │ claude/codex/ │   │
                     │  │ (webview)  │  │ threads,   │  │ (Copilot...) │  │ gemini/kiro   │   │
                     │  └────────────┘  │ decorations│  └─────┬────────┘  │ CLIs          │   │
                     │                  └────────────┘        │           └──┬────────────┘   │
                     │                                        │              │   ┌─────────┐  │
                     │                                        │              │   │ Ollama  │◄─┼── HTTP localhost
                     │                                        │              │   └─────────┘  │
                     └────────────────────────────────────────┼──────────────┼────────────────┘
                                                              │ HTTPS        │ HTTPS
                                                       ┌──────▼──────────────▼───────┐   ┌──────────────────┐
                                                       │ Model vendors (GitHub,      │   │ Anthropic API /  │
                                                       │ Anthropic, OpenAI, Google,  │   │ OpenAI API       │◄── direct HTTPS
                                                       │ AWS) via the user's tools   │   │ (user's API key) │    from LogicLens
                                                       └─────────────────────────────┘   └──────────────────┘
```

## External systems

The MVP uses only the VS Code Language Model API (tested with Copilot Free) and Claude Code. Rows marked S7 arrive after release (ADR-0025).

| System | Interface | Owned by | LogicLens holds credentials? |
|---|---|---|---|
| VS Code Language Model API | `vscode.lm.selectChatModels`, `LanguageModelChat.sendRequest` | VS Code plus contributing extensions (Copilot, others) | No. VS Code and the contributing extension handle auth and consent. |
| Claude Code CLI | Child process, stdin/stdout | Anthropic, installed by user | No. The CLI uses its own sign-in. |
| Codex CLI (S7) | Child process, stdin/stdout | OpenAI, installed by user | No. |
| Gemini CLI (S7) | Child process, stdin/stdout | Google, installed by user | No. |
| Kiro (IDE or CLI) (S7) | `vscode.lm` inside Kiro, or child process. Confirmed in S7 (ADR-0016). | AWS | No. |
| Anthropic Messages API (S7) | HTTPS, streaming | Anthropic | Yes: the user's key, in `SecretStorage`. |
| OpenAI API (S7) | HTTPS, streaming | OpenAI | Yes: the user's key, in `SecretStorage`. |
| Ollama (S7) | HTTP to localhost (configurable) | User | No. |
| VS Code Marketplace (Open VSX from S7, ADR-0026) | Publishing only, from CI | Microsoft, Eclipse Foundation | Publish tokens in CI secrets only. |

LogicLens makes no other network calls. The webview loads nothing remote.
