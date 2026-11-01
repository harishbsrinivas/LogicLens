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
│  │  ├─ registry.ts       # detection, selection, status
│  │  ├─ vscodeLm.ts
│  │  ├─ cli/              # shared spawn helper + claudeCode.ts (S6); codex.ts, gemini.ts, kiro.ts (S7)
│  │  └─ http/             # shared SSE reader + anthropic.ts, openai.ts, ollama.ts (S7)
│  ├─ explain/
│  │  ├─ context.ts        # builds target + context text with line numbers
│  │  ├─ walkthrough.ts    # orchestrates a walkthrough request
│  │  ├─ question.ts       # orchestrates a thread question
│  │  ├─ protocol.ts       # incremental parser for the tagged format
│  │  └─ anchor.ts         # validates and clamps ranges
│  ├─ prompts/             # templates as TS string builders, versioned
│  │  └─ personalities/    # one fragment per voice pack (S12, ADR-0023)
│  ├─ state/               # in-memory session: walkthroughs, threads, focus; rangeTracker, reanchor
│  ├─ cache/               # persisted walkthroughs and threads
│  ├─ nav/                 # trail model and follow-definition service (S10, ADR-0021)
│  ├─ bookmarks/           # bookmark store and service (S11, ADR-0022)
│  ├─ ui/
│  │  ├─ panel.ts          # WebviewViewProvider, message bridge
│  │  ├─ validate.ts       # pure validation of webview messages
│  │  ├─ activeEditor.ts   # the editor commands act on (survives panel focus)
│  │  ├─ contextKeys.ts    # menu context keys
│  │  ├─ decorations.ts    # step highlight, dimming, gutter numbers
│  │  ├─ comments.ts       # CommentController for threads
│  │  ├─ codeLens.ts
│  │  ├─ bookmarksView.ts  # TreeDataProvider for logiclens.bookmarks
│  │  └─ statusBar.ts
│  └─ util/                # logging (redacting), cancellation, ranges, hashing
├─ webview/                # panel UI source (Svelte 5, built by Vite) – ADR-0009
│  ├─ src/
│  └─ vite.config.mts
├─ shared/                 # message types shared by src/ and webview/
├─ test/
│  ├─ unit/                # vitest: protocol, anchor, context, guard, prompts
│  ├─ integration/         # @vscode/test-electron: commands, UI, fake provider
│  ├─ eval/                # evaluation corpus and runner (spec §10)
│  └─ fixtures/
└─ docs/
```

One pnpm package, not a multi-package workspace: `webview/` and `shared/` are folders built from the root `package.json`. Everything is bundled, so `vsce package --no-dependencies` never touches pnpm's symlinked `node_modules` (arch §9). Split into workspace packages only if a second consumer of `shared/` appears.

## Module rules

- `commands/` call services; they hold no logic beyond argument resolution.
- Only `explain/` calls providers, and only through `guard/RequestGate.send()`. A lint rule (`no-restricted-imports` in `eslint.config.mjs`) blocks importing anything under `providers/` except `providers/types` from `src/`, other than `src/providers/` itself and `src/extension.ts`, which builds the adapters and hands them to the gate. S5 widens the exception to `registry.ts` consumers in `ui/statusBar.ts` and `commands/provider.ts` for listing and selection.
- `providers/` knows nothing about walkthroughs, steps, or UI. Input is messages; output is a stream of text chunks plus usage.
- `ui/` renders state from `state/` and sends user intents to `commands/` or services. It never calls providers.
- `shared/` contains types only, so the webview bundle never pulls in Node code.
- `nav/` and `bookmarks/` never import `providers/` or `guard/`. Navigating and bookmarking cannot send code; "Explain again" and "Explain <symbol>" go through `commands/` like any other explain action.

## Activation

`activationEvents` are implicit from contributed commands and views (VS Code infers `onCommand` and `onView`). No `*` or `onStartupFinished`. CodeLens registration happens on first activation and only if `logiclens.codeLens.enabled` is on. The Comments API controller is registered on activation; the gutter "+" therefore appears only after LogicLens has activated once in the window. Open decision 4 (arch §10) covers whether to activate on `onLanguage` to show it earlier.

## Concurrency

- One walkthrough request per document at a time; a new one cancels the old one after confirmation.
- Up to two thread questions in flight across the window; extras queue.
- Every request carries a `CancellationToken` from the command through the provider to the child process or fetch.
