# 2. System Context

```
                     ┌──────────────────────────── user's machine ────────────────────────────┐
                     │                                                                        │
   developer ───────►│  VS Code (or compatible editor)                                        │
                     │  ┌──────────────────────────────────────────────────────────────────┐  │
                     │  │ Clarity extension host code                                     │  │
                     │  │  commands · RequestGate · explain pipeline · providers · state  │  │
                     │  └──────┬──────────────┬───────────────┬──────────────┬────────────┘  │
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
                                                       │ AWS) via the user's tools   │   │ (user's API key) │    from Clarity
                                                       └─────────────────────────────┘   └──────────────────┘
```

## External systems

| System | Interface | Owned by | Clarity holds credentials? |
|---|---|---|---|
| VS Code Language Model API | `vscode.lm.selectChatModels`, `LanguageModelChat.sendRequest` | VS Code plus contributing extensions (Copilot, others) | No. VS Code and the contributing extension handle auth and consent. |
| Claude Code CLI | Child process, stdin/stdout | Anthropic, installed by user | No. The CLI uses its own sign-in. |
| Codex CLI | Child process, stdin/stdout | OpenAI, installed by user | No. |
| Gemini CLI | Child process, stdin/stdout | Google, installed by user | No. |
| Kiro (IDE or CLI) | `vscode.lm` inside Kiro, or child process. Confirmed in S0 (ADR-0016). | AWS | No. |
| Anthropic Messages API | HTTPS, streaming | Anthropic | Yes: the user's key, in `SecretStorage`. |
| OpenAI API | HTTPS, streaming | OpenAI | Yes: the user's key, in `SecretStorage`. |
| Ollama | HTTP to localhost (configurable) | User | No. |
| VS Code Marketplace, Open VSX | Publishing only, from CI | Microsoft, Eclipse Foundation | Publish tokens in CI secrets only. |

Clarity makes no other network calls. The webview loads nothing remote.
