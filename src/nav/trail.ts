// Navigation trail (spec §13, ADR-0021): linear, browser-style history of Follow to Definition
// jumps. Pure; entries hold no code text. Persisted in workspace state by the follow service.

export const TRAIL_CAP = 30;

export interface TrailEntry {
  uri: string;
  /** Symbol name at the position, when known. */
  symbol?: string;
  /** 1-based cursor line and 0-based character. */
  line: number;
  character: number;
  /** 1-based first visible line, restored on return. */
  scrollTop: number;
  /** Walkthrough step focused when the user left, 0-based. */
  step: number | null;
}

export interface TrailState {
  entries: TrailEntry[];
  index: number;
}

export class Trail {
  private entries: TrailEntry[] = [];
  private current = -1;

  get size(): number {
    return this.entries.length;
  }

  get index(): number {
    return this.current;
  }

  get canGoBack(): boolean {
    return this.current > 0;
  }

  get canGoForward(): boolean {
    return this.current >= 0 && this.current < this.entries.length - 1;
  }

  all(): readonly TrailEntry[] {
    return this.entries;
  }

  at(index: number): TrailEntry | undefined {
    return Number.isSafeInteger(index) ? this.entries[index] : undefined;
  }

  /**
   * A follow from `from` to `to`: `from` replaces the current entry (or starts the trail),
   * forward entries are dropped, and the oldest go past the cap.
   */
  follow(from: TrailEntry, to: TrailEntry): void {
    if (this.current < 0) {
      this.entries = [from];
      this.current = 0;
    } else {
      this.entries = this.entries.slice(0, this.current + 1);
      this.entries[this.current] = from;
    }
    this.entries.push(to);
    if (this.entries.length > TRAIL_CAP) {
      this.entries = this.entries.slice(this.entries.length - TRAIL_CAP);
    }
    this.current = this.entries.length - 1;
  }

  /** Records where the user is before leaving the current entry (scroll, cursor, step). */
  update(entry: TrailEntry): void {
    if (this.current >= 0 && this.entries[this.current]?.uri === entry.uri) {
      this.entries[this.current] = entry;
    }
  }

  /** Moves to `index` and returns its entry, or undefined when out of range. */
  goTo(index: number): TrailEntry | undefined {
    const entry = this.at(index);
    if (entry) {
      this.current = index;
    }
    return entry;
  }

  remove(index: number): void {
    if (!this.at(index)) {
      return;
    }
    this.entries.splice(index, 1);
    if (this.current >= index) {
      this.current = Math.max(this.entries.length > 0 ? 0 : -1, this.current - 1);
    }
  }

  clear(): void {
    this.entries = [];
    this.current = -1;
  }

  serialize(): TrailState {
    return { entries: [...this.entries], index: this.current };
  }

  /** Restores a saved state, dropping anything malformed. */
  restore(state: unknown): void {
    this.clear();
    if (typeof state !== 'object' || state === null) {
      return;
    }
    const { entries, index } = state as Partial<TrailState>;
    const valid = (Array.isArray(entries) ? entries : []).filter(isEntry).slice(-TRAIL_CAP);
    this.entries = valid;
    this.current =
      typeof index === 'number' && index >= 0 && index < valid.length ? index : valid.length - 1;
  }
}

function isEntry(e: unknown): e is TrailEntry {
  if (typeof e !== 'object' || e === null) {
    return false;
  }
  const x = e as Record<string, unknown>;
  return (
    typeof x.uri === 'string' &&
    typeof x.line === 'number' &&
    typeof x.character === 'number' &&
    typeof x.scrollTop === 'number' &&
    (x.step === null || typeof x.step === 'number') &&
    (x.symbol === undefined || typeof x.symbol === 'string')
  );
}

const KEYWORDS = new Set(
  (
    'if else for while do switch case default break continue return function const let var new ' +
    'class extends super this import export from as async await yield try catch finally throw ' +
    'typeof instanceof in of void delete true false null undefined def elif pass lambda None True ' +
    'False and or not is with self fn pub mut impl struct enum match use mod func package go defer ' +
    'chan select type interface public private protected static final void int string bool'
  ).split(' '),
);

/**
 * Identifiers on the given lines, first occurrence of each, for the step "Follow…" menu
 * (spec §13). Keywords of common languages are skipped; the caller keeps only those that have a
 * definition. Pure.
 */
export function identifiersIn(
  lines: readonly string[],
  ranges: readonly { start: number; end: number }[],
  limit = 40,
): { name: string; line: number; character: number }[] {
  const seen = new Set<string>();
  const out: { name: string; line: number; character: number }[] = [];
  for (const r of ranges) {
    for (let l = r.start; l <= r.end && out.length < limit; l++) {
      // Strip string literals and line comments so their words are not offered.
      const text = (lines[l - 1] ?? '')
        .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, (m) => ' '.repeat(m.length))
        .replace(/(\/\/|#).*$/, '');
      for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const name = m[0];
        if (name.length > 1 && !KEYWORDS.has(name) && !seen.has(name) && out.length < limit) {
          seen.add(name);
          out.push({ name, line: l, character: m.index });
        }
      }
    }
  }
  return out;
}
