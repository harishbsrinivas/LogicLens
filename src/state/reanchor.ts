// Re-anchoring by original text (arch §7, ADR-0019): finds where a block of stored lines is now.
// Pure. Shared by the cache (S8) and bookmarks (S11). Lines withheld by the secret scan are
// stored as hashes, never as text (ADR-0020), and compared by hash.
import { createHash } from 'node:crypto';
import type { LineRange } from './types';

const HASH_PREFIX = 'sha256:';

/** A stored line: its text, or `sha256:<hex>` for a withheld line. */
export type StoredLine = string;

export function lineHash(text: string): StoredLine {
  return `${HASH_PREFIX}${createHash('sha256').update(text).digest('hex')}`;
}

export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** The lines of `range`, with withheld lines hashed. */
export function storeLines(
  lines: readonly string[],
  range: LineRange,
  withheld: ReadonlySet<number>,
): StoredLine[] {
  const out: StoredLine[] = [];
  for (let l = range.start; l <= range.end; l++) {
    const text = lines[l - 1] ?? '';
    out.push(withheld.has(l) ? lineHash(text) : text);
  }
  return out;
}

function same(current: string, stored: StoredLine, loose: boolean): boolean {
  if (stored.startsWith(HASH_PREFIX) && stored.length === HASH_PREFIX.length + 64) {
    return lineHash(current) === stored;
  }
  return loose ? squash(current) === squash(stored) : current === stored;
}

function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * The new 1-based start of `stored`, or undefined when it is gone. Exact matches win over
 * whitespace-insensitive ones; among matches, the one nearest `oldStart` wins.
 */
export function reanchor(
  current: readonly string[],
  stored: readonly StoredLine[],
  oldStart: number,
): number | undefined {
  if (stored.length === 0 || stored.length > current.length) {
    return undefined;
  }
  for (const loose of [false, true]) {
    let best: number | undefined;
    for (let start = 1; start + stored.length - 1 <= current.length; start++) {
      let ok = true;
      for (let i = 0; i < stored.length && ok; i++) {
        ok = same(current[start - 1 + i] ?? '', stored[i] ?? '', loose);
      }
      if (ok && (best === undefined || Math.abs(start - oldStart) < Math.abs(best - oldStart))) {
        best = start;
      }
    }
    if (best !== undefined) {
      return best;
    }
  }
  return undefined;
}
