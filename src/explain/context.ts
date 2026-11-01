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
    numberLines(input.lines.slice(0, start), input.firstLine, width),
    TARGET_START,
    numberLines(input.lines.slice(start, end), input.firstLine + start, width),
    TARGET_END,
    numberLines(input.lines.slice(end), input.firstLine + end, width),
  ];
  return `${header.join('\n')}\n\n${parts.filter(Boolean).join('\n')}`;
}

export function rangeText(r: LineRange): string {
  return r.start === r.end ? `L${r.start}` : `L${r.start}-L${r.end}`;
}
