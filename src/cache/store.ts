// Persisted walkthrough and thread cache (arch §7, ADR-0019). JSON files in VS Code's extension
// storage, never in the workspace. One file per document and settings combination, named by a
// SHA-256 of the key; an index keeps sizes and last-opened times for LRU eviction. Writes are
// atomic (temp file, then rename). Uses Node's async fs only, so it is unit tested on a temp dir.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Turn } from '../state/questions';
import type { StoredLine } from '../state/reanchor';
import type { LineRange, WalkthroughView } from '../state/types';

export const CACHE_FORMAT = 1;
export const CACHE_CAP_BYTES = 50 * 1024 * 1024;
const INDEX = 'index.json';

export interface CacheKey {
  uri: string;
  provider: string;
  model: string;
  depth: string;
  audience: string;
  jargon: string;
  language: string;
  personality: string;
  promptVersion: number;
  /** `L5-L8` for a selection or symbol walkthrough, empty for the whole file. */
  target: string;
}

export interface CachedThread {
  range: LineRange;
  turns: Turn[];
  /** The thread's lines when saved, for re-anchoring. */
  lines: StoredLine[];
}

export interface CacheEntry {
  format: typeof CACHE_FORMAT;
  key: CacheKey;
  savedAt: number;
  /** SHA-256 of the document text when saved; equal means nothing moved. */
  textHash: string;
  /** Null when the document has question threads but no walkthrough. */
  view: WalkthroughView | null;
  /** The model's raw response, for Continue. */
  raw: string;
  /** Per step, per range: the lines when saved (withheld lines hashed). */
  stepLines: StoredLine[][][];
  /** Per withheld line: its hash, for re-anchoring the lock icons. */
  withheldLines: StoredLine[];
  targetLines: StoredLine[] | null;
  threads: CachedThread[];
}

interface IndexEntry {
  uri: string;
  size: number;
  savedAt: number;
  lastOpened: number;
}

type Index = Map<string, IndexEntry>;

export function keyFile(key: CacheKey): string {
  const text = JSON.stringify([
    key.uri,
    key.provider,
    key.model,
    key.depth,
    key.audience,
    key.jargon,
    key.language,
    key.personality,
    key.promptVersion,
    key.target,
  ]);
  return `${createHash('sha256').update(text).digest('hex')}.json`;
}

export class CacheStore {
  /** Operations run one at a time so the index is never written concurrently. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly capBytes = CACHE_CAP_BYTES,
    private readonly now: () => number = Date.now,
  ) {}

  save(entry: CacheEntry): Promise<void> {
    return this.serial(async () => {
      await mkdir(this.dir, { recursive: true });
      const file = keyFile(entry.key);
      const data = JSON.stringify(entry);
      await this.atomicWrite(file, data);
      const index = await this.readIndex();
      // Older entries of the same document stay (other settings); the newest is restored.
      index.set(file, {
        uri: entry.key.uri,
        size: Buffer.byteLength(data),
        savedAt: entry.savedAt,
        lastOpened: this.now(),
      });
      await this.evict(index);
      await this.writeIndex(index);
    });
  }

  /** The most recently saved entry for a document, or undefined. Bad files are deleted. */
  latest(uri: string): Promise<CacheEntry | undefined> {
    return this.serial(async () => {
      const index = await this.readIndex();
      const files = [...index]
        .filter(([, e]) => e.uri === uri)
        .sort(([, a], [, b]) => b.savedAt - a.savedAt);
      for (const [file, meta] of files) {
        const entry = await this.readEntry(file);
        if (entry && entry.key.uri === uri) {
          meta.lastOpened = this.now();
          await this.writeIndex(index);
          return entry;
        }
        index.delete(file);
        await rm(join(this.dir, file), { force: true });
        await this.writeIndex(index);
      }
      return undefined;
    });
  }

  /** Removes every entry for a document. */
  forget(uri: string): Promise<void> {
    return this.serial(async () => {
      const index = await this.readIndex();
      for (const [file, e] of [...index]) {
        if (e.uri === uri) {
          index.delete(file);
          await rm(join(this.dir, file), { force: true });
        }
      }
      await this.writeIndex(index);
    });
  }

  clear(): Promise<void> {
    return this.serial(() => rm(this.dir, { recursive: true, force: true }));
  }

  private async readEntry(file: string): Promise<CacheEntry | undefined> {
    try {
      const entry = JSON.parse(await readFile(join(this.dir, file), 'utf8')) as Partial<CacheEntry>;
      return entry.format === CACHE_FORMAT && entry.key && Array.isArray(entry.threads)
        ? (entry as CacheEntry)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async evict(index: Index): Promise<void> {
    let total = [...index.values()].reduce((n, e) => n + e.size, 0);
    const oldest = [...index].sort(([, a], [, b]) => a.lastOpened - b.lastOpened);
    for (const [file, e] of oldest) {
      if (total <= this.capBytes) {
        break;
      }
      index.delete(file);
      total -= e.size;
      await rm(join(this.dir, file), { force: true });
    }
  }

  private async readIndex(): Promise<Index> {
    try {
      const index = JSON.parse(await readFile(join(this.dir, INDEX), 'utf8')) as unknown;
      return typeof index === 'object' && index !== null
        ? new Map(Object.entries(index as Record<string, IndexEntry>))
        : new Map();
    } catch {
      // Missing or corrupt: start again; unreferenced files are harmless and get overwritten.
      return new Map();
    }
  }

  private async writeIndex(index: Index): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await this.atomicWrite(INDEX, JSON.stringify(Object.fromEntries(index)));
  }

  private async atomicWrite(file: string, data: string): Promise<void> {
    const tmp = join(this.dir, `${file}.${process.pid}.tmp`);
    await writeFile(tmp, data, 'utf8');
    await rename(tmp, join(this.dir, file));
  }

  private serial<T>(op: () => Promise<T>): Promise<T> {
    const next = this.queue.then(op, op);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
