import { describe, expect, it } from 'vitest';
import { ensureNotice, noticeKey } from '../../src/guard/notice';
import { ensureTerms, TERMS_KEY, TERMS_VERSION, termsAccepted } from '../../src/guard/terms';
import { FakePrompter, MemoryStore } from './helpers';
import { readFileSync } from 'node:fs';

describe('terms of use', () => {
  it('records acceptance only on I Agree', async () => {
    const store = new MemoryStore();
    const prompter = new FakePrompter();
    expect(await ensureTerms(store, prompter)).toBe(true);
    expect(termsAccepted(store)).toBe(true);
    expect(store.get<{ version: string }>(TERMS_KEY)?.version).toBe(TERMS_VERSION);
  });

  it('does not record on cancel', async () => {
    const store = new MemoryStore();
    const prompter = new FakePrompter();
    prompter.termsAnswer = 'cancel';
    expect(await ensureTerms(store, prompter)).toBe(false);
    expect(termsAccepted(store)).toBe(false);
  });

  it('opens the terms on view and does not record', async () => {
    const store = new MemoryStore();
    const prompter = new FakePrompter();
    prompter.termsAnswer = 'view';
    expect(await ensureTerms(store, prompter)).toBe(false);
    expect(prompter.calls).toEqual(['terms', 'openTerms']);
    expect(termsAccepted(store)).toBe(false);
  });

  it('asks again when the version changes', async () => {
    const store = new MemoryStore();
    await store.update(TERMS_KEY, { version: '2000-01-01', acceptedAt: 'x' });
    const prompter = new FakePrompter();
    prompter.termsAnswer = 'cancel';
    expect(await ensureTerms(store, prompter)).toBe(false);
    expect(prompter.calls).toEqual(['terms']);
  });

  it('does not ask once accepted', async () => {
    const store = new MemoryStore();
    await ensureTerms(store, new FakePrompter());
    const prompter = new FakePrompter();
    expect(await ensureTerms(store, prompter)).toBe(true);
    expect(prompter.calls).toEqual([]);
  });

  it('matches the version in TERMS.md', () => {
    const text = readFileSync(new URL('../../TERMS.md', import.meta.url), 'utf8');
    expect(text).toContain(`**Version:** ${TERMS_VERSION}`);
  });
});

describe('data notice', () => {
  const provider = { id: 'p', label: 'P', termsUrl: 'https://example.com' };

  it('records per provider on continue', async () => {
    const store = new MemoryStore();
    expect(await ensureNotice(store, new FakePrompter(), provider)).toBe(true);
    expect(store.get(noticeKey('p'))).toBeTruthy();
    const again = new FakePrompter();
    expect(await ensureNotice(store, again, provider)).toBe(true);
    expect(again.calls).toEqual([]);
  });

  it('opens the provider terms on view and sends nothing', async () => {
    const store = new MemoryStore();
    const prompter = new FakePrompter();
    prompter.noticeAnswer = 'view';
    expect(await ensureNotice(store, prompter, provider)).toBe(false);
    expect(prompter.calls).toEqual(['notice', 'openUrl https://example.com']);
  });

  it('refuses on cancel', async () => {
    const prompter = new FakePrompter();
    prompter.noticeAnswer = 'cancel';
    expect(await ensureNotice(new MemoryStore(), prompter, provider)).toBe(false);
  });
});
