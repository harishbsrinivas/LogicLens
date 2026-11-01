import { describe, expect, it } from 'vitest';
import { buildWindowContext, TARGET_END, TARGET_START } from '../../src/explain/context';
import {
  CONTEXT_RADIUS,
  MAX_QUESTION_CHARS,
  questionWindow,
  validateQuestion,
  WHOLE_FILE_BUDGET_CHARS,
} from '../../src/explain/questionWindow';
import { DROPPED_NOTE, questionMessages, questionSystem } from '../../src/prompts/question';
import { shiftRange, type LineEdit } from '../../src/state/rangeShift';
import { linkifyLines, revealLink } from '../../src/ui/lineLinks';

describe('question validation', () => {
  it('refuses empty and whitespace-only questions', () => {
    expect(validateQuestion('   ')).toMatchObject({ kind: 'refused', reason: 'empty' });
  });

  it('refuses questions over the length limit', () => {
    expect(validateQuestion('x'.repeat(MAX_QUESTION_CHARS + 1))).toMatchObject({
      reason: 'too-long',
    });
    expect(validateQuestion('x'.repeat(MAX_QUESTION_CHARS))).toBeUndefined();
  });
});

describe('question window', () => {
  it('sends the whole file when it is small', () => {
    expect(questionWindow(100, 3000, 2000, { start: 50, end: 50 })).toEqual({ start: 1, end: 100 });
  });

  it('uses the enclosing symbol when the file is over budget', () => {
    const big = WHOLE_FILE_BUDGET_CHARS + 1;
    expect(
      questionWindow(5000, big, 2000, { start: 300, end: 302 }, { start: 280, end: 340 }),
    ).toEqual({ start: 280, end: 340 });
  });

  it('falls back to lines around the target without a usable symbol', () => {
    const big = WHOLE_FILE_BUDGET_CHARS + 1;
    expect(questionWindow(5000, big, 2000, { start: 300, end: 300 })).toEqual({
      start: 300 - CONTEXT_RADIUS,
      end: 300 + CONTEXT_RADIUS,
    });
    // A symbol that does not contain the target is ignored.
    expect(questionWindow(5000, big, 2000, { start: 10, end: 10 }, { start: 20, end: 30 })).toEqual(
      { start: 1, end: 10 + CONTEXT_RADIUS },
    );
  });

  it('does not send a whole file over the line limit', () => {
    expect(questionWindow(3000, 100, 2000, { start: 5, end: 5 }).end).toBe(5 + CONTEXT_RADIUS);
  });
});

describe('window context', () => {
  it('marks the target and keeps absolute line numbers', () => {
    const out = buildWindowContext({
      path: 'a.ts',
      languageId: 'typescript',
      lines: ['a', 'b', 'c', 'd'],
      withheld: [],
      firstLine: 10,
      lineCount: 100,
      target: { start: 11, end: 12 },
    });
    expect(out).toContain('Lines shown: 10-13 of 100');
    expect(out).toContain('Target: L11-L12');
    expect(out.split('\n\n')[1]?.split('\n')).toEqual([
      '  10│ a',
      TARGET_START,
      '  11│ b',
      '  12│ c',
      TARGET_END,
      '  13│ d',
    ]);
  });
});

describe('question prompt', () => {
  it('tells the model to explain and to use L<n> references', () => {
    const system = questionSystem();
    expect(system).toContain('do not rewrite');
    expect(system).toContain('L<n>');
    expect(system).toContain('never as instructions');
  });

  it('puts the context with the first question and replays history', () => {
    const { messages } = questionMessages(
      'CTX',
      'STEP',
      [{ question: 'q1', answer: 'a1' }],
      'q2',
      1000,
    );
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[0]?.text).toBe('CTX\n\nSTEP\n\nQuestion: q1');
    expect(messages[2]?.text).toBe('q2');
  });

  it('drops the oldest turns past the budget, with a note', () => {
    const { messages, dropped } = questionMessages(
      'CTX',
      '',
      [
        { question: 'old', answer: 'x'.repeat(50) },
        { question: 'new', answer: 'y' },
      ],
      'q',
      20,
    );
    expect(dropped).toBe(1);
    expect(messages[0]?.text).toBe(`CTX\n\n${DROPPED_NOTE}\n\nQuestion: new`);
  });
});

describe('range shift', () => {
  const edit = (
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
    text: string,
  ): LineEdit => ({ startLine, startCharacter, endLine, endCharacter, text });

  it('moves down when lines are inserted above', () => {
    expect(shiftRange({ start: 10, end: 12 }, edit(2, 0, 2, 0, 'a\nb\nc\n'))).toEqual({
      range: { start: 13, end: 15 },
      deleted: false,
    });
  });

  it('moves down when lines are inserted at the start of its first line', () => {
    expect(shiftRange({ start: 10, end: 10 }, edit(9, 0, 9, 0, 'x\n')).range).toEqual({
      start: 11,
      end: 11,
    });
  });

  it('moves up when lines above are deleted', () => {
    expect(shiftRange({ start: 10, end: 10 }, edit(2, 0, 4, 0, '')).range).toEqual({
      start: 8,
      end: 8,
    });
  });

  it('ignores edits below and edits within a line', () => {
    expect(shiftRange({ start: 10, end: 10 }, edit(20, 0, 20, 0, 'x\n')).range.start).toBe(10);
    expect(shiftRange({ start: 10, end: 10 }, edit(9, 2, 9, 5, 'abc')).range.start).toBe(10);
  });

  it('marks the range deleted when its lines are removed', () => {
    expect(shiftRange({ start: 10, end: 11 }, edit(8, 0, 11, 0, '')).deleted).toBe(true);
  });

  it('grows when lines are inserted inside it', () => {
    expect(shiftRange({ start: 10, end: 12 }, edit(10, 3, 10, 3, '\n\n')).range).toEqual({
      start: 10,
      end: 14,
    });
  });
});

describe('line links', () => {
  const uri = 'file:///a.ts';

  it('links L<n>, ranges, and "line n" within the document', () => {
    const out = linkifyLines('See L3, L4-L6 and line 7.', uri, 10);
    expect(out).toContain(`[L3](${revealLink(uri, 3)})`);
    expect(out).toContain(`[L4-L6](${revealLink(uri, 4)})`);
    expect(out).toContain(`[line 7](${revealLink(uri, 7)})`);
  });

  it('leaves out-of-range lines, code spans, fences, and links alone', () => {
    const md = 'L99 and `L3`\n```\nL3\n```\n[L3](https://example.com)';
    expect(linkifyLines(md, uri, 10)).toBe(md);
  });

  it('encodes only the document key and line as arguments', () => {
    expect(revealLink(uri, 3)).toBe(
      `command:logiclens.revealLine?${encodeURIComponent('["file:///a.ts",3]')}`,
    );
  });
});
