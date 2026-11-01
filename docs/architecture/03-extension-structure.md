# 3. Extension Structure

## Folder layout (proposed)

```
logiclens/
├─ package.json            # manifest: contributions per spec §9; scripts per arch §9
├─ pnpm-lock.yaml          # committed; CI uses --frozen-lockfile
├─ pnpm-workspace.yaml     # single package; allowBuilds limited to esbuild; audited overrides
├─ .npmrc                  # pnpm settings (engine-strict)
├─ esbuild.mjs             # extension host bundle
├─ src/
│  ├─ extension.ts         # activate/deactivate; wires modules; nothing else
│  ├─ commands/            # one file per command group; thin, call services
│  ├─ guard/               # RequestGate (gate.ts, pure) and its checks: terms, trust, exclude, size,
│  │                       #   notice, secretScan; settings.ts and vscodePrompter.ts bind them to VS Code
│  ├─ providers/
│  │  ├─ types.ts          # Provider, ProviderState, ChatMessage, StreamChunk
│  │  ├─ registry.ts       # detection, resolution, cache, change events (S5)
│  │  ├─ vscodeLm.ts
│  │  ├─ cli/              # shared spawn helper + claudeCode.ts (S6); codex.ts, gemini.ts, kiro.ts (S7)
│  │  └─ http/             # shared SSE reader + anthropic.ts, openai.ts, ollama.ts (S7)
│  ├─ explain/
│  │  ├─ context.ts        # builds target + context text with line numbers
│  │  ├─ walkthrough.ts    # orchestrates a walkthrough request
│  │  ├─ question.ts       # orchestrates a thread question (S4)
│  │  ├─ questionWindow.ts # pure: question limits, validation, context window
│  │  ├─ symbols.ts        # document symbols via the language's symbol provider
│  │  ├─ protocol.ts       # incremental parser for the tagged format
│  │  └─ anchor.ts         # validates and clamps ranges
│  ├─ prompts/             # templates as TS string builders, versioned (walkthrough.ts from S2)
│  │  └─ personalities/    # one fragment per voice pack (S12, ADR-0023)
│  ├─ state/               # in-memory session: walkthroughs, focus (session.ts), question threads
│  │                       #   (questions.ts), rangeShift.ts (S4); rangeTracker, reanchor (S8)
│  ├─ cache/               # persisted walkthroughs and threads
│  ├─ nav/                 # trail model and follow-definition service (S10, ADR-0021)
│  ├─ bookmarks/           # bookmark store and service (S11, ADR-0022)
│  ├─ ui/
│  │  ├─ inlineThreads.ts  # inline explanation threads (ADR-0028) on the shared CommentController
│  │  ├─ questionThreads.ts# question threads, commenting ranges, edit tracking (S4)
│  │  ├─ lineLinks.ts      # pure: L<n> references to revealLine links
│  │  ├─ safeMarkdown.ts   # pure: images to links, non-http(s) links dropped
│  │  ├─ activeEditor.ts   # the editor commands act on (survives focus in other views)
│  │  ├─ contextKeys.ts    # menu context keys
│  │  ├─ decorations.ts    # step highlight, dimming, gutter numbers
│  │  ├─ codeLens.ts       # step title rows, trail breadcrumbs, opt-in "Explain"
│  │  ├─ stepContext.ts    # context keys, follow-cursor focus, stale marking
│  │  ├─ bookmarksView.ts  # TreeDataProvider for logiclens.bookmarks
│  │  ├─ providerPicker.ts # pure: provider and model picker entries (S5)
│  │  └─ statusBar.ts      # provider and model, busy, no-provider warning (S5)
│  └─ util/                # logging (redacting), cancellation, ranges, hashing
├─ test/
│  ├─ unit/                # vitest: protocol, anchor, context, guard, prompts
│  ├─ integration/         # @vscode/test-electron: commands, UI, fake provider
│  ├─ eval/                # evaluation corpus and runner (spec §10)
│  └─ fixtures/
└─ docs/
```

One pnpm package. Everything is bundled into `dist/extension.js`, so `vsce package --no-dependencies` never touches pnpm's symlinked `node_modules` (arch §9). There is no webview bundle (ADR-0028).

## Module rules

- `commands/` call services; they hold no logic beyond argument resolution.
- Only `explain/` calls providers, and only through `guard/RequestGate.send()`. A lint rule (`no-restricted-imports` in `eslint.config.mjs`) blocks importing anything under `providers/` except `providers/types` from `src/`, other than `src/providers/` itself and `src/extension.ts`, which builds the adapters and hands them to the gate. S5 widened the exception to the registry's consumers `ui/statusBar.ts`, `ui/providerPicker.ts`, and `commands/provider.ts`, which list and select providers but never send.
- `providers/` knows nothing about walkthroughs, steps, or UI. Input is messages; output is a stream of text chunks plus usage.
- `ui/` renders state from `state/` and sends user intents to `commands/` or services. It never calls providers.
- `nav/` and `bookmarks/` never import `providers/` or `guard/`. Navigating and bookmarking cannot send code; "Explain again" and "Explain <symbol>" go through `commands/` like any other explain action.

## Activation

`activationEvents` are implicit from contributed commands (VS Code infers `onCommand`; `onView` joins with the Bookmarks view in S11). No `*` or `onStartupFinished`. CodeLens registration happens on first activation and only if `logiclens.codeLens.enabled` is on. The Comments API controller (created in `extension.ts`, shared by explanations and questions) is registered on activation; the gutter "+" therefore appears only after LogicLens has activated once in the window. ADR-0030 keeps it that way: no `onLanguage` activation. "Ask About This Line" is in the editor context menu and bound to `Ctrl+Alt+E Q`, both of which activate the extension.

## Concurrency

- One walkthrough request per document at a time; a new one cancels the old one after confirmation.
- Up to two thread questions in flight across the window; extras queue.
- Every request carries a `CancellationToken` from the command through the provider to the child process or fetch.
