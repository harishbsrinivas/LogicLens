// Bookmark store (ADR-0022, arch §7): one bookmarks.json in VS Code's extension storage, next
// to the cache but separate from it. Atomic writes; a file that does not parse is kept aside as
// bookmarks.json.corrupt and the store starts empty. Node async fs only, so it is unit tested.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newId } from '../util/id';
import type { StoredLine } from '../state/reanchor';
import type { LineRange } from '../state/types';

export const BOOKMARK_CAP = 500;
export const BOOKMARKS_FILE = 'bookmarks.json';

export type BookmarkKind = 'step' | 'answer' | 'code';

export interface Bookmark {
  id: string;
  kind: BookmarkKind;
  uri: string;
  ranges: LineRange[];
  /** Per range, its lines when saved (withheld lines as hashes), for re-anchoring. */
  lines: StoredLine[][];
  /** Step title, question, or first line of code (withheld lines never). */
  title: string;
  /** A copy of the explanation or answer Markdown; empty for code bookmarks. */
  markdown: string;
  question?: string;
  note: string;
  provider?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  /** The lines could not be found again (spec §14). */
  changed: boolean;
}

export type NewBookmark = Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt' | 'changed'>;

export class BookmarkStore {
  private bookmarks: Bookmark[] = [];
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly dir: string,
    private readonly now: () => number = Date.now,
  ) {}

  onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const file = join(this.dir, BOOKMARKS_FILE);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      return; // no bookmarks yet
    }
    try {
      const data = JSON.parse(text) as { bookmarks?: unknown };
      this.bookmarks = (Array.isArray(data.bookmarks) ? data.bookmarks : []).filter(isBookmark);
    } catch {
      // Keep the user's data aside rather than overwrite it; start empty.
      await rename(file, `${file}.corrupt`).catch(() => undefined);
    }
    this.fire();
  }

  list(): readonly Bookmark[] {
    return this.bookmarks;
  }

  get(id: string): Bookmark | undefined {
    return this.bookmarks.find((b) => b.id === id);
  }

  inDocument(uri: string): Bookmark[] {
    return this.bookmarks.filter((b) => b.uri === uri);
  }

  /** Undefined when the cap is reached (spec §14). */
  async add(input: NewBookmark): Promise<Bookmark | undefined> {
    await this.load();
    if (this.bookmarks.length >= BOOKMARK_CAP) {
      return undefined;
    }
    const now = this.now();
    const bookmark: Bookmark = {
      ...input,
      id: newId('b'),
      createdAt: now,
      updatedAt: now,
      changed: false,
    };
    this.bookmarks.push(bookmark);
    await this.persist();
    return bookmark;
  }

  async update(id: string, change: (b: Bookmark) => void, touch = true): Promise<void> {
    const bookmark = this.get(id);
    if (!bookmark) {
      return;
    }
    change(bookmark);
    if (touch) {
      bookmark.updatedAt = this.now();
    }
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    await this.persist();
  }

  async clear(): Promise<void> {
    this.bookmarks = [];
    await this.persist();
  }

  /** Writes the current bookmarks; callers that changed them in place call this. */
  persist(): Promise<void> {
    this.fire();
    const data = JSON.stringify({ version: 1, bookmarks: this.bookmarks });
    const op = async (): Promise<void> => {
      await mkdir(this.dir, { recursive: true });
      const file = join(this.dir, BOOKMARKS_FILE);
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, data, 'utf8');
      await rename(tmp, file);
    };
    const next = this.queue.then(op, op);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private fire(): void {
    this.listeners.forEach((l) => l());
  }
}

function isBookmark(b: unknown): b is Bookmark {
  if (typeof b !== 'object' || b === null) {
    return false;
  }
  const x = b as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    (x.kind === 'step' || x.kind === 'answer' || x.kind === 'code') &&
    typeof x.uri === 'string' &&
    Array.isArray(x.ranges) &&
    Array.isArray(x.lines) &&
    typeof x.markdown === 'string' &&
    typeof x.note === 'string'
  );
}

/** Label in the Bookmarks view (spec §14): the note, else the title. Pure. */
export function bookmarkLabel(b: Bookmark): string {
  return (b.note.trim() || b.title.trim() || '(bookmark)').replace(/\s+/g, ' ').slice(0, 120);
}

/** Copy as Markdown: location, note, and the saved explanation. No code text. Pure. */
export function bookmarkMarkdown(b: Bookmark, fileName: string): string {
  const where = b.ranges
    .map((r) => (r.start === r.end ? `L${r.start}` : `L${r.start}–${r.end}`))
    .join(', ');
  const parts = [
    `### ${b.note.trim() || b.title.trim() || 'Bookmark'}`,
    `\`${fileName}\` ${where}`,
  ];
  if (b.question) {
    parts.push(`**Q:** ${b.question}`);
  }
  if (b.markdown.trim()) {
    parts.push(b.markdown.trim());
  }
  if (b.provider) {
    parts.push(
      `*${b.provider}${b.model ? ` · ${b.model}` : ''}, ${new Date(b.createdAt).toISOString().slice(0, 10)}*`,
    );
  }
  return parts.join('\n\n');
}
