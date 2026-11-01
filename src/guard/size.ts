// Size limits and the generated-file warning (spec §3 Limits).

export const MAX_BYTES = 200 * 1024;
export const DEFAULT_MAX_LINES = 2000;
const MINIFIED_LINE_CHARS = 1000;
const HEADER_LINES = 5;

export function sizeProblem(
  lines: readonly string[],
  byteLength: number,
  maxLines: number,
): string | undefined {
  if (lines.length > maxLines) {
    return `This file has ${lines.length} lines, more than the ${maxLines}-line limit (logiclens.maxLines).`;
  }
  if (byteLength > MAX_BYTES) {
    return `This file is ${Math.round(byteLength / 1024)} KB, more than the 200 KB limit.`;
  }
  return undefined;
}

export function looksGenerated(lines: readonly string[]): boolean {
  if (lines.some((l) => l.length > MINIFIED_LINE_CHARS)) {
    return true;
  }
  return lines.slice(0, HEADER_LINES).some((l) => /@generated\b|\bDO NOT EDIT\b/.test(l));
}
