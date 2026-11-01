import { describe, expect, it } from 'vitest';
import { DETECT_CACHE_MS, ProviderRegistry, resolveFrom } from '../../src/providers/registry';
import { modelEntries, providerEntries } from '../../src/ui/providerPicker';
import { FakeProvider } from './helpers';

function fake(id: string, ready = true): FakeProvider {
  const p = new FakeProvider();
  Object.assign(p, { id, label: `Provider ${id}` });
  p.state = ready
    ? {
        kind: 'ready',
        models: [
          { id: `${id}-1`, label: `${id} one` },
          { id: `${id}-2`, label: `${id} two` },
        ],
      }
    : { kind: 'not-installed', reason: `${id} is not installed.` };
  return p;
}

const statuses = async (...ps: FakeProvider[]) =>
  Promise.all(ps.map(async (provider) => ({ provider, state: await provider.detect() })));

describe('provider resolution', () => {
  it('auto picks the first ready provider in order and its first model', async () => {
    const r = resolveFrom(await statuses(fake('a', false), fake('b'), fake('c')), 'auto', '');
    expect(r).toMatchObject({ kind: 'ready', provider: { id: 'b' }, model: { id: 'b-1' } });
  });

  it('uses the configured model when the provider lists it', async () => {
    const r = resolveFrom(await statuses(fake('b')), 'b', 'b-2');
    expect(r).toMatchObject({ kind: 'ready', model: { id: 'b-2' } });
  });

  it('never falls back from an explicit provider that is not ready', async () => {
    const r = resolveFrom(await statuses(fake('a', false), fake('b')), 'a', '');
    expect(r).toEqual({ kind: 'unavailable', reason: 'a is not installed.', providerId: 'a' });
  });

  it('refuses a model the provider does not list instead of switching models', async () => {
    const r = resolveFrom(await statuses(fake('b')), 'b', 'gone');
    expect(r).toMatchObject({ kind: 'unavailable', providerId: 'b' });
    expect(r.kind === 'unavailable' && r.reason).toContain('"gone"');
  });

  it('says no provider is ready when none is', async () => {
    const r = resolveFrom(await statuses(fake('a', false), fake('c', false)), 'auto', '');
    expect(r.kind).toBe('unavailable');
  });
});

describe('ProviderRegistry', () => {
  it('caches detection for a minute and re-detects when forced or invalidated', async () => {
    let now = 0;
    const b = fake('b');
    let calls = 0;
    const detect = b.detect.bind(b);
    b.detect = () => {
      calls++;
      return detect();
    };
    const registry = new ProviderRegistry({
      providers: [b],
      settings: () => ({ provider: 'auto', model: '' }),
      now: () => now,
    });
    await registry.detectAll();
    await registry.detectAll();
    expect(calls).toBe(1);
    now = DETECT_CACHE_MS + 1;
    await registry.detectAll();
    expect(calls).toBe(2);
    await registry.detectAll(true);
    expect(calls).toBe(3);
    let changed = 0;
    registry.onDidChange(() => changed++);
    registry.invalidate();
    await registry.detectAll();
    expect([calls, changed]).toEqual([4, 1]);
  });

  it('turns a failing detect into an unavailable state', async () => {
    const b = fake('b');
    b.detect = () => Promise.reject(new Error('boom'));
    const registry = new ProviderRegistry({
      providers: [b],
      settings: () => ({ provider: 'b', model: '' }),
    });
    const r = await registry.resolve();
    expect(r.kind === 'unavailable' && r.reason).toContain('boom');
  });

  it('an override brings its own model; the model setting belongs to the configured provider', async () => {
    const registry = new ProviderRegistry({
      providers: [fake('a'), fake('b')],
      settings: () => ({ provider: 'a', model: 'a-2' }),
    });
    expect(await registry.resolve()).toMatchObject({ model: { id: 'a-2' } });
    expect(await registry.resolve({ provider: 'b' })).toMatchObject({ model: { id: 'b-1' } });
    expect(await registry.resolve({ provider: 'b', model: 'b-2' })).toMatchObject({
      model: { id: 'b-2' },
    });
  });
});

describe('provider picker entries', () => {
  it('lists Auto, then Ready, then the others with their setup action', async () => {
    const a = fake('a', false);
    Object.assign(a, { setup: { label: 'Install A', url: 'https://example.com' } });
    const entries = providerEntries(await statuses(a, fake('b')), 'b');
    expect(entries.map((e) => (e.kind === 'item' ? e.value : `--${e.label}`))).toEqual([
      'auto',
      '--Ready',
      'b',
      '--Not ready',
      'setup:a',
    ]);
    const b = entries.find((e) => e.kind === 'item' && e.value === 'b');
    expect(b).toMatchObject({ picked: true, description: '2 models' });
    const setup = entries.at(-1);
    expect(setup).toMatchObject({ description: 'Not installed' });
    expect(setup?.kind === 'item' && setup.detail).toBe('a is not installed. Pick to install A.');
  });

  it('offers the default model first', () => {
    const entries = modelEntries([{ id: 'x', label: 'X' }], 'x');
    expect(entries.map((e) => (e.kind === 'item' ? [e.value, e.picked] : null))).toEqual([
      ['', false],
      ['x', true],
    ]);
  });
});
