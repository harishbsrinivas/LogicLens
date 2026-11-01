import { describe, expect, it } from 'vitest';
import { RequestGate, type GateDeps, type GateTarget } from '../../src/guard/gate';
import { WITHHELD_MARKER } from '../../src/guard/secretScan';
import { TERMS_KEY, TERMS_VERSION } from '../../src/guard/terms';
import {
  collect,
  fake,
  FakePrompter,
  FakeProvider,
  MemoryLogger,
  MemoryStore,
  token,
} from './helpers';

const AWS = fake('AKIA', 'Q7RT2MZX4LNB8VHC');

function setup(overrides: Partial<GateDeps> = {}) {
  const state = new MemoryStore();
  void state.update(TERMS_KEY, { version: TERMS_VERSION, acceptedAt: 'x' });
  const prompter = new FakePrompter();
  const provider = new FakeProvider();
  const log = new MemoryLogger();
  const deps: GateDeps = {
    state,
    prompter,
    isTrusted: () => true,
    isExcluded: () => false,
    settings: () => ({ maxLines: 2000, secretsAction: 'skip-lines' }),
    provider: () => provider,
    log,
    ...overrides,
  };
  return { gate: new RequestGate(deps), state, prompter, provider, log };
}

function target(lines: string[]): GateTarget {
  return {
    fileName: 'a.ts',
    relPath: 'src/a.ts',
    languageId: 'typescript',
    lines,
    byteLength: lines.join('\n').length,
  };
}

const build = (prepared: { lines: string[] }) => ({
  system: 'SYS',
  messages: [{ role: 'user' as const, text: prepared.lines.join('\n') }],
});

const CODE = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;', 'const e = 5;'];

describe('RequestGate', () => {
  it('sends after all checks pass, with the first model', async () => {
    const { gate, provider } = setup();
    const outcome = await gate.send({ target: target(CODE), build }, token());
    expect(outcome.kind).toBe('sent');
    if (outcome.kind !== 'sent') return;
    expect(outcome.model).toBe('Model One');
    expect(await collect(outcome.stream)).toHaveLength(3);
    expect(provider.requests[0]?.model).toBe('m1');
  });

  it('refuses before anything else when terms are not accepted, and sends nothing', async () => {
    const { gate, state, prompter, provider } = setup({ isTrusted: () => false });
    state.data.clear();
    prompter.termsAnswer = 'cancel';
    const outcome = await gate.send({ target: target(CODE), build }, token());
    expect(outcome).toMatchObject({ kind: 'refused', reason: 'terms' });
    expect(prompter.calls).toEqual(['terms']);
    expect(provider.requests).toHaveLength(0);
  });

  it('refuses untrusted workspaces', async () => {
    const { gate } = setup({ isTrusted: () => false });
    expect(await gate.send({ target: target(CODE), build }, token())).toMatchObject({
      reason: 'untrusted',
    });
  });

  it('refuses excluded files (async matcher)', async () => {
    const { gate } = setup({ isExcluded: async () => true });
    expect(await gate.send({ target: target(CODE), build }, token())).toMatchObject({
      reason: 'excluded',
    });
  });

  it('refuses files over the line limit', async () => {
    const { gate } = setup({ settings: () => ({ maxLines: 2, secretsAction: 'skip-lines' }) });
    expect(await gate.send({ target: target(CODE), build }, token())).toMatchObject({
      reason: 'too-large',
    });
  });

  it('asks before sending generated code', async () => {
    const { gate, prompter } = setup();
    prompter.confirmAnswer = false;
    const outcome = await gate.send({ target: target(['// @generated', ...CODE]), build }, token());
    expect(outcome).toMatchObject({ reason: 'cancelled' });
  });

  it('refuses when the provider is not ready', async () => {
    const { gate, provider } = setup();
    provider.state = { kind: 'unavailable', reason: 'No models.' };
    expect(await gate.send({ target: target(CODE), build }, token())).toMatchObject({
      reason: 'provider-unavailable',
      message: 'No models.',
    });
  });

  it('refuses when the data notice is cancelled', async () => {
    const { gate, prompter, provider } = setup();
    prompter.noticeAnswer = 'cancel';
    expect(await gate.send({ target: target(CODE), build }, token())).toMatchObject({
      reason: 'cancelled',
    });
    expect(provider.requests).toHaveLength(0);
  });

  it('withholds flagged lines, keeping line numbers, and never logs the value', async () => {
    const { gate, provider, log } = setup();
    const lines = [...CODE.slice(0, 2), `const id = '${AWS}';`, ...CODE.slice(2)];
    const outcome = await gate.send({ target: target(lines), build }, token());
    expect(outcome).toMatchObject({ kind: 'sent', withheld: [3] });
    if (outcome.kind !== 'sent') return;
    await collect(outcome.stream);
    const sent = (provider.requests[0]?.messages[0]?.text ?? '').split('\n');
    expect(sent).toHaveLength(lines.length);
    expect(sent[2]).toBe(WITHHELD_MARKER);
    expect(JSON.stringify(provider.requests)).not.toContain(AWS);
    expect(log.lines.join('\n')).not.toContain(AWS);
    expect(log.lines.join('\n')).toContain('L3 aws-access-key-id');
  });

  it('reports withheld lines as document lines for a window target', async () => {
    const { gate, provider } = setup();
    const lines = [...CODE.slice(0, 2), `const id = '${AWS}';`, ...CODE.slice(2)];
    const outcome = await gate.send(
      { target: { ...target(lines), firstLine: 40 }, build },
      token(),
    );
    expect(outcome).toMatchObject({ kind: 'sent', withheld: [42] });
    if (outcome.kind !== 'sent') return;
    await collect(outcome.stream);
    expect((provider.requests[0]?.messages[0]?.text ?? '').split('\n')[2]).toBe(WITHHELD_MARKER);
  });

  it('refuses under refuse-file and lists the lines', async () => {
    const { gate, provider } = setup({
      settings: () => ({ maxLines: 2000, secretsAction: 'refuse-file' }),
    });
    const lines = [...CODE, `const id = '${AWS}';`];
    const outcome = await gate.send({ target: target(lines), build }, token());
    expect(outcome).toMatchObject({ kind: 'refused', reason: 'secrets', lines: [6] });
    expect(provider.requests).toHaveLength(0);
  });

  it('honors a one-request skip-lines override', async () => {
    const { gate } = setup({
      settings: () => ({ maxLines: 2000, secretsAction: 'refuse-file' }),
    });
    const lines = [...CODE, `const id = '${AWS}';`];
    const outcome = await gate.send(
      { target: target(lines), build, secretsAction: 'skip-lines' },
      token(),
    );
    expect(outcome).toMatchObject({ kind: 'sent', withheld: [6] });
  });

  it('refuses a secrets file above 25% withheld even under skip-lines', async () => {
    const { gate } = setup();
    const lines = ['const a = 1;', `x = '${AWS}'`, `y = '${AWS}'`, 'const b = 2;'];
    expect(await gate.send({ target: target(lines), build }, token())).toMatchObject({
      reason: 'secrets-file',
      lines: [2, 3],
    });
  });

  it('refuses when the built request still contains a secret', async () => {
    const { gate, provider } = setup();
    const outcome = await gate.send(
      {
        target: target(CODE),
        build: () => ({ system: `x ${AWS}`, messages: [] }),
      },
      token(),
    );
    expect(outcome).toMatchObject({ reason: 'secrets' });
    expect(provider.requests).toHaveLength(0);
  });

  it('refuses when cancelled before sending', async () => {
    const { gate } = setup();
    expect(await gate.send({ target: target(CODE), build }, token(true))).toMatchObject({
      reason: 'cancelled',
    });
  });
});
