// `vscode-lm` adapter (arch §4). The VS Code API is injected so this file stays unit testable.
import {
  ProviderError,
  type CancelToken,
  type Provider,
  type ProviderRequest,
  type ProviderState,
  type StreamChunk,
} from './types';

export interface LmModel {
  id: string;
  name: string;
  vendor: string;
  /** 0 when the vendor does not report it. */
  maxInputTokens: number;
  sendRequest(
    messages: LmMessage[],
    token: CancelToken,
  ): PromiseLike<{ text: AsyncIterable<string> }>;
}

/** Opaque message object built by the injected API. */
export type LmMessage = unknown;

export interface LmApi {
  /** Undefined when the editor has no Language Model API (some forks). */
  selectChatModels: (() => Promise<LmModel[]>) | undefined;
  userMessage(text: string): LmMessage;
  assistantMessage(text: string): LmMessage;
  /** Returns the `LanguageModelError` code, or undefined if the error is not one. */
  errorCode(err: unknown): string | undefined;
}

/**
 * Default order: Copilot chat models first (ADR-0025), then the largest input window. VS Code
 * 1.142 also lists agent-backed models (vendor `copilotcli`, no token limit) first; they are
 * kept, not filtered, but ranked last (S0 spike, arch §4).
 */
export function rankModels(models: readonly LmModel[]): LmModel[] {
  return [...models].sort(
    (a, b) =>
      Number(b.vendor === 'copilot') - Number(a.vendor === 'copilot') ||
      b.maxInputTokens - a.maxInputTokens,
  );
}

/** Model IDs repeat across vendors (both Copilot vendors expose `auto`), so keys include it. */
export function modelKey(m: LmModel): string {
  return `${m.vendor}/${m.id}`;
}

export function createVscodeLmProvider(api: LmApi): Provider {
  async function models(): Promise<LmModel[]> {
    return rankModels(api.selectChatModels ? await api.selectChatModels() : []);
  }

  return {
    id: 'vscode-lm',
    label: 'VS Code Language Models',
    kind: 'vscode-lm',
    termsUrl: 'https://code.visualstudio.com/docs/copilot/overview',
    dataLeavesMachine: true,
    setup: { label: 'Install GitHub Copilot', extensionId: 'GitHub.copilot-chat' },

    async detect(): Promise<ProviderState> {
      if (!api.selectChatModels) {
        return { kind: 'unavailable', reason: 'This editor has no Language Model API.' };
      }
      const list = await models();
      if (list.length === 0) {
        return {
          kind: 'unavailable',
          reason:
            'No language models are available. Install and sign in to GitHub Copilot, or another extension that provides models.',
        };
      }
      return {
        kind: 'ready',
        models: list.map((m) => ({ id: modelKey(m), label: `${m.vendor} · ${m.name}` })),
      };
    },

    async *stream(request: ProviderRequest, token: CancelToken): AsyncIterable<StreamChunk> {
      const list = await models();
      const model = (request.model && list.find((m) => modelKey(m) === request.model)) || list[0];
      if (!model) {
        throw new ProviderError('not-found', 'No language model is available.');
      }
      // The Language Model API has no system role in every version (arch §4), so the system
      // prompt goes first as a user message.
      const messages = [
        api.userMessage(request.system),
        ...request.messages.map((m) =>
          m.role === 'user' ? api.userMessage(m.text) : api.assistantMessage(m.text),
        ),
      ];
      try {
        const response = await model.sendRequest(messages, token);
        for await (const text of response.text) {
          if (token.isCancellationRequested) {
            throw new ProviderError('cancelled', 'Stopped.');
          }
          yield { type: 'text', text };
        }
      } catch (err) {
        throw mapError(api, err, token);
      }
      if (token.isCancellationRequested) {
        throw new ProviderError('cancelled', 'Stopped.');
      }
      yield { type: 'done' };
    },
  };
}

function mapError(api: LmApi, err: unknown, token: CancelToken): ProviderError {
  if (err instanceof ProviderError) {
    return err;
  }
  if (token.isCancellationRequested) {
    return new ProviderError('cancelled', 'Stopped.');
  }
  switch (api.errorCode(err)) {
    case 'NoPermissions':
      return new ProviderError(
        'auth',
        'LogicLens is not allowed to use this language model. Run the command again and allow access when VS Code asks.',
      );
    case 'Blocked':
      return new ProviderError(
        'quota',
        'The language model provider blocked the request. You may have hit a usage limit; try again later.',
      );
    case 'NotFound':
      return new ProviderError('not-found', 'The language model is no longer available.');
    default:
      return new ProviderError(
        'unknown',
        `The language model request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
  }
}
