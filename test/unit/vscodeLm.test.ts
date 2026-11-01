import { describe, expect, it } from 'vitest';
import {
  createVscodeLmProvider,
  rankModels,
  type LmApi,
  type LmModel,
} from '../../src/providers/vscodeLm';
import { ProviderError } from '../../src/providers/types';
import { collect, token } from './helpers';

class FakeLmError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function model(
  id: string,
  chunks: string[] | Error,
  sent: unknown[][] = [],
  vendor = 'copilot',
  maxInputTokens = 100,
): LmModel {
  return {
    id,
    name: `Name ${id}`,
    vendor,
    maxInputTokens,
    async sendRequest(messages) {
      sent.push(messages);
      if (chunks instanceof Error) {
        throw chunks;
      }
      return {
        text: (async function* () {
          yield* chunks;
        })(),
      };
    },
  };
}

function api(models: LmModel[] | undefined): LmApi {
  return {
    selectChatModels: models ? async () => models : undefined,
    userMessage: (text) => ({ role: 'user', text }),
    assistantMessage: (text) => ({ role: 'assistant', text }),
    errorCode: (err) => (err instanceof FakeLmError ? err.code : undefined),
  };
}

const request = { system: 'SYS', messages: [{ role: 'user' as const, text: 'code' }] };

describe('vscode-lm adapter', () => {
  it('reports unavailable without the Language Model API', async () => {
    const state = await createVscodeLmProvider(api(undefined)).detect();
    expect(state.kind).toBe('unavailable');
  });

  it('reports unavailable when no models exist', async () => {
    expect((await createVscodeLmProvider(api([])).detect()).kind).toBe('unavailable');
  });

  it('lists models with vendor and name', async () => {
    const state = await createVscodeLmProvider(api([model('a', [])])).detect();
    expect(state).toEqual({
      kind: 'ready',
      models: [{ id: 'copilot/a', label: 'copilot · Name a' }],
    });
  });

  it('sends the system prompt first as a user message and streams text', async () => {
    const sent: unknown[][] = [];
    const provider = createVscodeLmProvider(api([model('a', ['one ', 'two'], sent)]));
    const chunks = await collect(provider.stream(request, token()));
    expect(chunks).toEqual([
      { type: 'text', text: 'one ' },
      { type: 'text', text: 'two' },
      { type: 'done' },
    ]);
    expect(sent[0]).toEqual([
      { role: 'user', text: 'SYS' },
      { role: 'user', text: 'code' },
    ]);
  });

  it('uses the requested model when present', async () => {
    const sentA: unknown[][] = [];
    const sentB: unknown[][] = [];
    const provider = createVscodeLmProvider(
      api([model('a', ['x'], sentA), model('b', ['y'], sentB)]),
    );
    await collect(provider.stream({ ...request, model: 'copilot/b' }, token()));
    expect(sentA).toHaveLength(0);
    expect(sentB).toHaveLength(1);
  });

  it('defaults to a Copilot model with the largest window, ranking agent models last', async () => {
    const sentAgent: unknown[][] = [];
    const sentBig: unknown[][] = [];
    const provider = createVscodeLmProvider(
      api([
        model('auto', ['x'], sentAgent, 'copilotcli', 0),
        model('gpt-4o-mini', ['y'], [], 'copilot', 12078),
        model('auto', ['z'], sentBig, 'copilot', 935793),
      ]),
    );
    const state = await provider.detect();
    expect(state.kind === 'ready' && state.models.map((m) => m.label)).toEqual([
      'copilot · Name auto',
      'copilot · Name gpt-4o-mini',
      'copilotcli · Name auto',
    ]);
    await collect(provider.stream(request, token()));
    await collect(provider.stream({ ...request, model: 'copilot/auto' }, token()));
    expect(sentBig).toHaveLength(2);
    expect(sentAgent).toHaveLength(0);
  });

  it('keeps non-Copilot vendors, ordered by window size', () => {
    const ranked = rankModels([model('s', [], [], 'other', 10), model('l', [], [], 'other', 20)]);
    expect(ranked.map((m) => m.id)).toEqual(['l', 's']);
  });

  it('throws not-found when there is no model', async () => {
    const provider = createVscodeLmProvider(api([]));
    await expect(collect(provider.stream(request, token()))).rejects.toMatchObject({
      category: 'not-found',
    });
  });

  it.each([
    ['NoPermissions', 'auth'],
    ['Blocked', 'quota'],
    ['NotFound', 'not-found'],
    ['Other', 'unknown'],
  ])('maps %s to %s', async (code, category) => {
    const provider = createVscodeLmProvider(api([model('a', new FakeLmError(code))]));
    const err = await collect(provider.stream(request, token())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).category).toBe(category);
  });

  it('stops with cancelled when the token fires mid-stream', async () => {
    const t = token();
    const m: LmModel = {
      id: 'a',
      name: 'a',
      vendor: 'v',
      maxInputTokens: 0,
      async sendRequest() {
        return {
          text: (async function* () {
            yield 'first';
            t.cancel();
            yield 'second';
          })(),
        };
      },
    };
    const seen: string[] = [];
    const err = await (async () => {
      for await (const c of createVscodeLmProvider(api([m])).stream(request, t)) {
        if (c.type === 'text') seen.push(c.text);
      }
    })().catch((e: unknown) => e);
    expect(seen).toEqual(['first']);
    expect((err as ProviderError).category).toBe('cancelled');
  });
});
