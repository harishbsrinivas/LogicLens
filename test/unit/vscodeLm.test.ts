import { describe, expect, it } from 'vitest';
import { createVscodeLmProvider, type LmApi, type LmModel } from '../../src/providers/vscodeLm';
import { ProviderError } from '../../src/providers/types';
import { collect, token } from './helpers';

class FakeLmError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function model(id: string, chunks: string[] | Error, sent: unknown[][] = []): LmModel {
  return {
    id,
    name: `Name ${id}`,
    vendor: 'copilot',
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
    expect(state).toEqual({ kind: 'ready', models: [{ id: 'a', label: 'copilot · Name a' }] });
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
    await collect(provider.stream({ ...request, model: 'b' }, token()));
    expect(sentA).toHaveLength(0);
    expect(sentB).toHaveLength(1);
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
