import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEntry, restoreEntry } from '../../src/cache/restore';
import { CacheStore, keyFile, type CacheKey } from '../../src/cache/store';
import { refreshUser } from '../../src/prompts/refresh';
import { applyEdits, type LineEdit } from '../../src/state/rangeTracker';
import { lineHash, reanchor, storeLines } from '../../src/state/reanchor';
import type { WalkthroughView } from '../../src/state/types';

const edit = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
  text: string,
): LineEdit => ({
  startLine,
  startCharacter,
  endLine,
  endCharacter,
  text,
});

describe('range tracker', () => {
  it('marks a range touched when text inside it changes', () => {
    expect(applyEdits({ start: 5, end: 8 }, [edit(5, 2, 5, 4, 'xy')])).toEqual({
      range: { start: 5, end: 8 },
      deleted: false,
      touched: true,
    });
  });

  it('applies multi-cursor edits bottom-up', () => {
    // One line added above (line 2) and one inside (line 6): start moves by 1, end by 2.
    const r = applyEdits({ start: 5, end: 8 }, [edit(1, 0, 1, 0, 'a\n'), edit(5, 0, 5, 0, 'b\n')]);
    expect(r).toMatchObject({ range: { start: 6, end: 10 }, touched: true });
  });

  it('an undo that restores the lines moves the range back', () => {
    const inserted = applyEdits({ start: 5, end: 5 }, [edit(0, 0, 0, 0, 'a\nb\n')]);
    const undone = applyEdits(inserted.range, [edit(0, 0, 2, 0, '')]);
    expect(undone.range).toEqual({ start: 5, end: 5 });
  });
});

describe('re-anchoring', () => {
  const file = [
    'a',
    'function f() {',
    '  return 1;',
    '}',
    'b',
    'function f() {',
    '  return 1;',
    '}',
  ];

  it('finds an exact block, nearest the old position', () => {
    expect(reanchor(file, ['function f() {', '  return 1;', '}'], 7)).toBe(6);
    expect(reanchor(file, ['function f() {', '  return 1;', '}'], 1)).toBe(2);
  });

  it('falls back to a whitespace-insensitive match', () => {
    expect(reanchor(file, ['function  f(){', 'return 1;', '}'], 2)).toBe(2);
  });

  it('follows a block moved down and reports a deleted one', () => {
    const moved = [...Array<string>(20).fill(''), ...file];
    expect(reanchor(moved, ['b'], 5)).toBe(25);
    expect(reanchor(file, ['gone'], 1)).toBeUndefined();
  });

  it('compares withheld lines by hash, never storing their text', () => {
    const lines = ['x', 'const key = "abc";', 'y'];
    const stored = storeLines(lines, { start: 1, end: 3 }, new Set([2]));
    expect(stored[1]).toBe(lineHash('const key = "abc";'));
    expect(stored.join('\n')).not.toContain('abc');
    expect(reanchor(['new', ...lines], stored, 1)).toBe(2);
  });
});

function view(overrides: Partial<WalkthroughView> = {}): WalkthroughView {
  return {
    id: 'w1',
    target: null,
    style: { depth: 'standard', audience: 'practitioner', jargon: 'auto', language: 'en' },
    fileName: 'a.ts',
    providerLabel: 'P',
    model: 'M',
    status: 'done',
    overview: 'Overview.',
    steps: [
      {
        index: 0,
        title: 'One',
        ranges: [{ start: 2, end: 3 }],
        text: 't1',
        concepts: [],
        anchored: true,
      },
      {
        index: 1,
        title: 'Two',
        ranges: [{ start: 5, end: 5 }],
        text: 't2',
        concepts: [],
        anchored: true,
      },
    ],
    summary: '',
    watch: '',
    fallbackMarkdown: null,
    notice: null,
    error: null,
    durationMs: 10,
    withheld: [],
    stale: false,
    ...overrides,
  };
}

const KEY: CacheKey = {
  uri: 'file:///w/a.ts',
  provider: 'P',
  model: 'M',
  depth: 'standard',
  audience: 'practitioner',
  jargon: 'auto',
  language: 'en',
  personality: '',
  promptVersion: 2,
  target: '',
};

const LINES = ['import x;', 'function one() {', '  return 1;', '', 'two();'];

describe('restore', () => {
  const entry = buildEntry({
    key: KEY,
    lines: LINES,
    view: view(),
    raw: 'RAW',
    threads: [],
    now: 1,
  });

  it('loads as is when the text is the same', () => {
    const r = restoreEntry(entry, LINES);
    expect(r.view?.steps.map((s) => [s.ranges, s.changed])).toEqual([
      [[{ start: 2, end: 3 }], false],
      [[{ start: 5, end: 5 }], false],
    ]);
    expect(r.view).toMatchObject({ restored: true, stale: false });
    expect(r.raw).toBe('RAW');
  });

  it('follows moved code and marks steps whose code is gone', () => {
    const now = ['// header', '', '', ...LINES.slice(0, 4), 'three();'];
    const r = restoreEntry(entry, now);
    expect(r.view?.steps[0]).toMatchObject({ ranges: [{ start: 5, end: 6 }], changed: false });
    expect(r.view?.steps[1]).toMatchObject({ changed: true });
    expect(r.view?.stale).toBe(true);
  });

  it('saves only finished question turns and re-anchors threads', () => {
    const e = buildEntry({
      key: KEY,
      lines: LINES,
      view: null,
      raw: '',
      threads: [
        {
          id: 'q1',
          key: KEY.uri,
          range: { start: 5, end: 5 },
          changed: false,
          turns: [
            {
              id: 't1',
              question: 'q',
              answer: 'a',
              status: 'done',
              providerLabel: 'P',
              model: 'M',
              error: null,
            },
            {
              id: 't2',
              question: 'q2',
              answer: '',
              status: 'streaming',
              providerLabel: 'P',
              model: 'M',
              error: null,
            },
          ],
        },
      ],
      now: 1,
    });
    expect(e.threads[0]?.turns.map((t) => t.id)).toEqual(['t1']);
    const r = restoreEntry(e, ['new', ...LINES]);
    expect(r.threads[0]).toMatchObject({ range: { start: 6, end: 6 }, changed: false });
  });
});

describe('CacheStore', () => {
  const dir = async () =>
    join(await mkdtemp(join(tmpdir(), 'logiclens-cache-')), 'logiclens-cache');
  const entry = (uri: string, savedAt = 1, pad = 0) =>
    buildEntry({
      key: { ...KEY, uri },
      lines: LINES,
      view: view({ overview: 'x'.repeat(pad) }),
      raw: '',
      threads: [],
      now: savedAt,
    });

  it('saves atomically and returns the newest entry for a document', async () => {
    const store = new CacheStore(await dir());
    await store.save(entry('file:///a', 1));
    await store.save({
      ...entry('file:///a', 5),
      key: { ...KEY, uri: 'file:///a', depth: 'detailed' },
    });
    expect((await store.latest('file:///a'))?.key.depth).toBe('detailed');
    expect(await store.latest('file:///b')).toBeUndefined();
  });

  it('deletes and ignores a corrupt file', async () => {
    const d = await dir();
    const store = new CacheStore(d);
    await store.save(entry('file:///a'));
    await writeFile(join(d, keyFile({ ...KEY, uri: 'file:///a' })), '{not json');
    expect(await store.latest('file:///a')).toBeUndefined();
    expect((await readdir(d)).filter((f) => f !== 'index.json')).toEqual([]);
  });

  it('evicts the least recently opened entries past the cap', async () => {
    let t = 0;
    const d = await dir();
    const store = new CacheStore(d, 6000, () => ++t);
    await store.save(entry('file:///a', 1, 2000));
    await store.save(entry('file:///b', 2, 2000));
    await store.latest('file:///a'); // a is now more recent than b
    await store.save(entry('file:///c', 3, 2000));
    expect(await store.latest('file:///b')).toBeUndefined();
    expect(await store.latest('file:///a')).toBeDefined();
  });

  it('forget and clear remove files', async () => {
    const d = await dir();
    const store = new CacheStore(d);
    await store.save(entry('file:///a'));
    await store.forget('file:///a');
    expect(await store.latest('file:///a')).toBeUndefined();
    await store.save(entry('file:///a'));
    await store.clear();
    await expect(readdir(d)).rejects.toThrow();
  });
});

describe('refresh prompt', () => {
  it('lists only the changed steps with their numbers and old ranges', () => {
    const text = refreshUser('CTX', 'Overview.', view().steps.slice(1));
    expect(text).toContain('- Step 2 (was L5): Two');
    expect(text).toContain('same step numbers');
    expect(text.endsWith('CTX')).toBe(true);
  });
});
