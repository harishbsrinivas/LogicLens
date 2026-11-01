// Turns line references in answers ("L42", "L42-L50", "line 42", "lines 42 to 50") into links
// that move the cursor (spec §5). Pure. Runs after safeMarkdown, so the only command links in an
// answer are these, and the comment enables only `logiclens.revealLine` (arch §8).
export const REVEAL_LINE_COMMAND = 'logiclens.revealLine';

const FENCE = /^ {0,3}(```|~~~)/;
/** Inline code spans and existing links are left alone. */
const PROTECTED = /(`+)[^`]*?\1|\[[^\]\n]*\]\([^)\n]*\)/g;
const REFERENCE =
  /\b(?:L(\d+)(?:\s*[-–—]\s*L?(\d+))?|lines?\s+(\d+)(?:\s*(?:[-–—]|to)\s*(\d+))?)\b/gi;

export function revealLink(uri: string, line: number): string {
  return `command:${REVEAL_LINE_COMMAND}?${encodeURIComponent(JSON.stringify([uri, line]))}`;
}

export function linkifyLines(markdown: string, uri: string, lineCount: number): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : linkifyLine(line, uri, lineCount);
    })
    .join('\n');
}

function linkifyLine(line: string, uri: string, lineCount: number): string {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(PROTECTED)) {
    out += replaceRefs(line.slice(last, m.index), uri, lineCount) + m[0];
    last = m.index + m[0].length;
  }
  return out + replaceRefs(line.slice(last), uri, lineCount);
}

function replaceRefs(text: string, uri: string, lineCount: number): string {
  return text.replace(REFERENCE, (whole, a?: string, _b?: string, c?: string) => {
    const line = Number(a ?? c);
    if (!Number.isSafeInteger(line) || line < 1 || line > lineCount) {
      return whole;
    }
    return `[${whole}](${revealLink(uri, line)})`;
  });
}
