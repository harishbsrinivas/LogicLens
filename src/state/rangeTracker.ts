// Range tracker (arch §7, ADR-0019): moves line ranges through document edits and says which
// ranges were touched or deleted. Pure. Used for walkthrough steps, question threads, and
// bookmarks.
import type { LineRange } from './types';

/** One content change in 0-based positions, as `TextDocumentContentChangeEvent` reports it. */
export interface LineEdit {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  text: string;
}

export interface Shifted {
  range: LineRange;
  /** Every anchored line was deleted. */
  deleted: boolean;
  /** The edit changed text inside the range. */
  touched: boolean;
}

/** Applies one edit to a 1-based inclusive range. */
export function shiftRange(range: LineRange, edit: LineEdit): Shifted {
  const added = edit.text.split('\n').length - 1;
  const delta = added - (edit.endLine - edit.startLine);
  const s0 = range.start - 1;
  const e0 = range.end - 1;
  // Entirely above: ends before the first line, or at its very start.
  if (edit.endLine < s0 || (edit.endLine === s0 && edit.endCharacter === 0)) {
    return {
      range: { start: range.start + delta, end: range.end + delta },
      deleted: false,
      touched: false,
    };
  }
  // Entirely below.
  if (edit.startLine > e0) {
    return { range, deleted: false, touched: false };
  }
  // Inside the lines without adding or removing any.
  if (delta === 0) {
    return { range, deleted: false, touched: true };
  }
  // Removes whole lines covering the range: from a line above (or the start of the first line)
  // through to past the last line.
  const coversStart =
    edit.startLine < s0 || (edit.startLine === s0 && edit.startCharacter === 0 && added === 0);
  if (delta < 0 && coversStart && edit.endLine > e0) {
    const line = Math.max(1, edit.startLine + 1);
    return { range: { start: line, end: line }, deleted: true, touched: true };
  }
  // Overlapping edit: keep the start (moved if the edit began above) and stretch the end.
  const start = edit.startLine < s0 ? edit.startLine + 1 : range.start;
  return {
    range: { start, end: Math.max(start, range.end + delta) },
    deleted: false,
    touched: true,
  };
}

/** Applies the edits of one change event, which refer to the old document, bottom-up. */
export function applyEdits(range: LineRange, edits: readonly LineEdit[]): Shifted {
  const sorted = [...edits].sort(
    (a, b) => b.startLine - a.startLine || b.startCharacter - a.startCharacter,
  );
  let result: Shifted = { range, deleted: false, touched: false };
  for (const edit of sorted) {
    const next = shiftRange(result.range, edit);
    result = {
      range: next.range,
      deleted: result.deleted || next.deleted,
      touched: result.touched || next.touched,
    };
  }
  return result;
}

/** Converts VS Code content changes (structurally typed, so this stays pure). */
export function toLineEdits(
  changes: readonly {
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    text: string;
  }[],
): LineEdit[] {
  return changes.map((c) => ({
    startLine: c.range.start.line,
    startCharacter: c.range.start.character,
    endLine: c.range.end.line,
    endCharacter: c.range.end.character,
    text: c.text,
  }));
}
