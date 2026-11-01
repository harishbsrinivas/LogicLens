// Moves a line range through a document edit (spec §5 "Lifetime"). Pure. S4 shifts question
// threads with this; S8 replaces it with the full range tracker for walkthroughs too.
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
}

/** Applies one edit to a 1-based inclusive range. */
export function shiftRange(range: LineRange, edit: LineEdit): Shifted {
  const added = edit.text.split('\n').length - 1;
  const delta = added - (edit.endLine - edit.startLine);
  const s0 = range.start - 1;
  const e0 = range.end - 1;
  // Entirely above: ends before the first line, or at its very start.
  if (edit.endLine < s0 || (edit.endLine === s0 && edit.endCharacter === 0)) {
    return { range: { start: range.start + delta, end: range.end + delta }, deleted: false };
  }
  // Entirely below, or inside the lines without adding or removing any.
  if (edit.startLine > e0 || delta === 0) {
    return { range, deleted: false };
  }
  // Removes whole lines covering the range: from a line above (or the start of the first line)
  // through to past the last line.
  const coversStart =
    edit.startLine < s0 || (edit.startLine === s0 && edit.startCharacter === 0 && added === 0);
  if (delta < 0 && coversStart && edit.endLine > e0) {
    const line = Math.max(1, edit.startLine + 1);
    return { range: { start: line, end: line }, deleted: true };
  }
  // Overlapping edit: keep the start (moved if the edit began above) and stretch the end.
  const start = edit.startLine < s0 ? edit.startLine + 1 : range.start;
  return { range: { start, end: Math.max(start, range.end + delta) }, deleted: false };
}
