import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_CAP,
  BOOKMARKS_FILE,
  bookmarkLabel,
  bookmarkMarkdown,
  BookmarkStore,
  type NewBookmark,
} from '../../src/bookmarks/store';
import { lineHash } from '../../src/state/reanchor';

const dir = () => mkdtemp(join(tmpdir(), 'logiclens-bm-'));
const input = (overrides: Partial<NewBookmark> = {}): NewBookmark => ({
  kind: 'code',
  uri: 'file:///w/a.ts',
  ranges: [{ start: 3, end: 5 }],
  lines: [['a', 'b', 'c']],
  title: 'const a = 1;',
  markdown: '',
  note: '',
  ...overrides,
});

describe('BookmarkStore', () => {
  it('adds, edits, removes, and persists across instances', async () => {
    const d = await dir();
    const store = new BookmarkStore(d, () => 42);
    const b = await store.add(input({ note: 'retry rule' }));
    expect(b).toMatchObject({ createdAt: 42, changed: false });
    await store.update(b?.id ?? '', (x) => (x.note = 'edited'));
    const again = new BookmarkStore(d);
    await again.load();
    expect(again.list().map((x) => x.note)).toEqual(['edited']);
    await again.remove(b?.id ?? '');
    expect(again.list()).toEqual([]);
    // Atomic: no temp files left behind.
    expect(await readdir(d)).toEqual([BOOKMARKS_FILE]);
  });

  it('refuses past the cap', async () => {
    const store = new BookmarkStore(await dir());
    for (let i = 0; i < BOOKMARK_CAP; i++) {
      (store as unknown as { bookmarks: unknown[] }).bookmarks.push({});
    }
    expect(await store.add(input())).toBeUndefined();
  });

  it('keeps a corrupt file aside and starts empty', async () => {
    const d = await dir();
    await writeFile(join(d, BOOKMARKS_FILE), '{oops');
    const store = new BookmarkStore(d);
    await store.load();
    expect(store.list()).toEqual([]);
    expect(await readFile(join(d, `${BOOKMARKS_FILE}.corrupt`), 'utf8')).toBe('{oops');
  });

  it('labels with the note, else the title; copies as Markdown without code', () => {
    const b = {
      ...input({ title: 'Load config', markdown: 'Reads it.', provider: 'P', model: 'M' }),
      id: 'x',
      createdAt: 0,
      updatedAt: 0,
      changed: false,
    };
    expect(bookmarkLabel(b)).toBe('Load config');
    expect(bookmarkLabel({ ...b, note: 'retry rule' })).toBe('retry rule');
    const md = bookmarkMarkdown({ ...b, lines: [[lineHash('secret')]] }, 'a.ts');
    expect(md).toBe('### Load config\n\n`a.ts` L3–5\n\nReads it.\n\n*P · M, 1970-01-01*');
  });
});
