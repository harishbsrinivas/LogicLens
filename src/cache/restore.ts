// Builds cache entries from state and restores state from them (arch §7, ADR-0019). Pure.
import type { QuestionThread } from '../state/questions';
import { lineHash, reanchor, storeLines, textHash } from '../state/reanchor';
import type { LineRange, WalkthroughView } from '../state/types';
import { CACHE_FORMAT, type CacheEntry, type CacheKey, type CachedThread } from './store';

export function buildEntry(input: {
  key: CacheKey;
  lines: readonly string[];
  view: WalkthroughView | null;
  raw: string;
  threads: readonly QuestionThread[];
  now: number;
}): CacheEntry {
  const { lines, view } = input;
  const withheld = new Set(view?.withheld ?? []);
  return {
    format: CACHE_FORMAT,
    key: input.key,
    savedAt: input.now,
    textHash: textHash(lines.join('\n')),
    // The restored copy is never mid-stream.
    view: view && { ...view, status: view.status === 'streaming' ? 'stopped' : view.status },
    raw: input.raw,
    stepLines: (view?.steps ?? []).map((s) => s.ranges.map((r) => storeLines(lines, r, withheld))),
    withheldLines: (view?.withheld ?? []).map((l) => lineHash(lines[l - 1] ?? '')),
    targetLines: view?.target ? storeLines(lines, view.target, withheld) : null,
    threads: input.threads
      .filter((t) => t.turns.some((x) => x.status === 'done'))
      .map((t): CachedThread => ({
        range: t.range,
        turns: t.turns.filter((x) => x.status === 'done'),
        lines: storeLines(lines, t.range, withheld),
      })),
  };
}

export interface Restored {
  view: WalkthroughView | null;
  raw: string;
  threads: { range: LineRange; turns: CachedThread['turns']; changed: boolean }[];
}

/**
 * Same text: loads as is. Otherwise each range is searched for by its saved lines (exact, then
 * whitespace-insensitive, nearest the old position); steps and threads not found are marked
 * changed and keep their old lines, clamped to the document (spec §10).
 */
export function restoreEntry(entry: CacheEntry, lines: readonly string[]): Restored {
  const same = textHash(lines.join('\n')) === entry.textHash;
  const move = (range: LineRange, stored: readonly string[] | undefined): LineRange | undefined => {
    if (same) {
      return range;
    }
    const start = stored ? reanchor(lines, stored, range.start) : undefined;
    return start === undefined ? undefined : { start, end: start + (range.end - range.start) };
  };
  const clamp = (r: LineRange): LineRange => {
    const start = Math.min(Math.max(1, r.start), Math.max(1, lines.length));
    return { start, end: Math.min(Math.max(start, r.end), Math.max(1, lines.length)) };
  };

  let view: WalkthroughView | null = null;
  if (entry.view) {
    const v = entry.view;
    const steps = v.steps.map((step, i) => {
      let changed = step.changed ?? false;
      const ranges = step.ranges.map((r, j) => {
        const moved = move(r, entry.stepLines[i]?.[j]);
        changed ||= moved === undefined;
        return moved ?? clamp(r);
      });
      return { ...step, ranges, changed };
    });
    const withheld = v.withheld.flatMap((line, i) => {
      const hash = entry.withheldLines[i];
      const moved = hash ? move({ start: line, end: line }, [hash]) : undefined;
      return moved ? [moved.start] : [];
    });
    const target = v.target
      ? (move(v.target, entry.targetLines ?? undefined) ?? clamp(v.target))
      : null;
    view = {
      ...v,
      steps,
      withheld,
      target,
      restored: true,
      stale: steps.some((s) => s.changed),
    };
  }
  return {
    view,
    raw: entry.raw,
    threads: entry.threads.map((t) => {
      const moved = move(t.range, t.lines);
      return { range: moved ?? clamp(t.range), turns: t.turns, changed: moved === undefined };
    }),
  };
}
