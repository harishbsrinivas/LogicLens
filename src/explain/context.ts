// Context builder (arch §5.3). S1: whole-file target, no budgeting beyond the size limit.

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
export function numberLines(lines: readonly string[], firstLine = 1): string {
  const width = String(firstLine + lines.length - 1).length;
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
