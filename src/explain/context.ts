// Context builder (arch §5.3): whole-file targets, and windows around a marked target (S4).
import type { LineRange } from '../state/types';

export const LINE_SEPARATOR = '│';

export interface ContextInput {
  /** Workspace-relative path, or the document's display name when it has none. */
  path: string;
  languageId: string;
  /** Target lines after the gate's secret scan (withheld lines already replaced). */
  lines: readonly string[];
  /** 1-based line numbers withheld by the secret scan. */
  withheld: readonly number[];
}

/** Prefixes each line with its absolute 1-based number, padded to equal width (ADR-0010). */
export function numberLines(
  lines: readonly string[],
  firstLine = 1,
  width = String(firstLine + lines.length - 1).length,
): string {
  return lines
    .map((line, i) => `${String(firstLine + i).padStart(width + 2)}${LINE_SEPARATOR} ${line}`)
    .join('\n');
}

export function buildFileContext(input: ContextInput): string {
  const header = [`File: ${input.path}`, `Language: ${input.languageId}`];
  header.push(`Lines: ${input.lines.length}`);
  if (input.withheld.length > 0) {
    header.push(`Withheld lines: ${input.withheld.map((l) => `L${l}`).join(', ')}`);
  }
  return `${header.join('\n')}\n\n${numberLines(input.lines)}`;
}

export const TARGET_START = '<<<TARGET';
export const TARGET_END = 'TARGET>>>';

export interface WindowInput extends ContextInput {
  /** 1-based document line of `lines[0]`. */
  firstLine: number;
  /** Lines in the whole document. */
  lineCount: number;
  /** Document lines the question or selection is about; marked in the output. */
  target: LineRange;
}

/** Numbers a window of the document and wraps the target lines in marker lines (arch §5.3). */
export function buildWindowContext(input: WindowInput): string {
  const last = input.firstLine + input.lines.length - 1;
  const header = [`File: ${input.path}`, `Language: ${input.languageId}`];
  header.push(
    input.firstLine === 1 && last === input.lineCount
      ? `Lines: ${input.lineCount}`
      : `Lines shown: ${input.firstLine}-${last} of ${input.lineCount}`,
  );
  header.push(`Target: ${rangeText(input.target)}`);
  if (input.withheld.length > 0) {
    header.push(`Withheld lines: ${input.withheld.map((l) => `L${l}`).join(', ')}`);
  }
  const width = String(last).length;
  const start = Math.max(input.target.start, input.firstLine) - input.firstLine;
  const end = Math.min(input.target.end, last) - input.firstLine + 1;
  const parts = [
    input.firstLine > 1 ? omitted(1, input.firstLine - 1) : '',
    numberLines(input.lines.slice(0, start), input.firstLine, width),
    TARGET_START,
    numberLines(input.lines.slice(start, end), input.firstLine + start, width),
    TARGET_END,
    numberLines(input.lines.slice(end), input.firstLine + end, width),
    last < input.lineCount ? omitted(last + 1, input.lineCount) : '',
  ];
  return `${header.join('\n')}\n\n${parts.filter(Boolean).join('\n')}`;
}

function omitted(start: number, end: number): string {
  return `… lines ${start}–${end} omitted …`;
}

/** About 24k tokens at 4 characters per token (arch §5.3). */
export const CONTEXT_BUDGET_CHARS = 96_000;

/**
 * Lines to send with a selection or symbol target (arch §5.3): the target whole, then the
 * enclosing symbol if it fits, then lines outward one at a time on each side until the budget
 * or `maxLines` is reached. A file that fits is sent whole. Pure.
 */
export function contextWindow(
  lines: readonly string[],
  target: LineRange,
  budgetChars: number,
  maxLines: number,
  symbol?: LineRange,
): LineRange {
  const cost = (line: number): number => (lines[line - 1]?.length ?? 0) + 1;
  let start = target.start;
  let end = target.end;
  let used = 0;
  for (let l = start; l <= end; l++) {
    used += cost(l);
  }
  if (symbol && symbol.start <= start && symbol.end >= end) {
    let extra = 0;
    for (let l = symbol.start; l <= symbol.end; l++) {
      extra += l < start || l > end ? cost(l) : 0;
    }
    if (used + extra <= budgetChars && symbol.end - symbol.start < maxLines) {
      start = symbol.start;
      end = symbol.end;
      used += extra;
    }
  }
  for (let grew = true; grew;) {
    grew = false;
    if (start > 1 && end - start + 1 < maxLines && used + cost(start - 1) <= budgetChars) {
      start--;
      used += cost(start);
      grew = true;
    }
    if (end < lines.length && end - start + 1 < maxLines && used + cost(end + 1) <= budgetChars) {
      end++;
      used += cost(end);
      grew = true;
    }
  }
  return { start, end };
}

export function rangeText(r: LineRange): string {
  return r.start === r.end ? `L${r.start}` : `L${r.start}-L${r.end}`;
}
