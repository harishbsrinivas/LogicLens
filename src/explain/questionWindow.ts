// Pure parts of the question pipeline (spec §5): limits, validation, and the context window.
import type { RefusalReason } from '../guard/gate';
import type { LineRange } from '../state/types';

export const MAX_QUESTION_CHARS = 2000;
/** Questions in flight across the window; extras wait (arch §3). */
export const MAX_IN_FLIGHT = 2;
/** Lines on each side of the target when there is no enclosing symbol (spec §5). */
export const CONTEXT_RADIUS = 40;
/** The whole file is sent only below this size (about 15k tokens). */
export const WHOLE_FILE_BUDGET_CHARS = 60_000;
export const HISTORY_BUDGET_CHARS = 16_000;
/** A symbol larger than this is not used as the window. */
export const MAX_SYMBOL_LINES = 400;

export type AskResult =
  | { kind: 'done' | 'stopped'; threadId: string; turnId: string }
  | { kind: 'failed'; threadId: string; turnId: string; message: string }
  | {
      kind: 'refused';
      reason: RefusalReason | 'empty' | 'too-long';
      message: string;
      lines?: number[];
    };

/** Picks the lines sent with a question (spec §5). Pure. */
export function questionWindow(
  lineCount: number,
  totalChars: number,
  maxLines: number,
  target: LineRange,
  symbol?: LineRange,
): LineRange {
  if (totalChars <= WHOLE_FILE_BUDGET_CHARS && lineCount <= maxLines) {
    return { start: 1, end: lineCount };
  }
  if (
    symbol &&
    symbol.start <= target.start &&
    symbol.end >= target.end &&
    symbol.end - symbol.start < MAX_SYMBOL_LINES
  ) {
    return symbol;
  }
  return {
    start: Math.max(1, target.start - CONTEXT_RADIUS),
    end: Math.min(lineCount, target.end + CONTEXT_RADIUS),
  };
}

export function validateQuestion(text: string): AskResult | undefined {
  if (!text.trim()) {
    return { kind: 'refused', reason: 'empty', message: 'Type a question first.' };
  }
  if (text.length > MAX_QUESTION_CHARS) {
    return {
      kind: 'refused',
      reason: 'too-long',
      message: `Questions are limited to ${MAX_QUESTION_CHARS} characters; this one has ${text.length}.`,
    };
  }
  return undefined;
}
