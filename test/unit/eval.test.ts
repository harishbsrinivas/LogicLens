import { describe, expect, it } from 'vitest';
import { evaluate } from '../eval/run';

describe('evaluation runner', () => {
  it('measures a response against its source', () => {
    const source = 'a\nb\n\nc\nd';
    const response = '@@overview\nO\n@@step 1 | L1-L2 | A\nx\n@@step 2 | L40 | B\ny\n@@end\n';
    expect(evaluate(response, source)).toEqual({
      parsed: true,
      complete: true,
      steps: 2,
      anchorRate: 0.5,
      coverage: 0.5,
    });
  });

  it('reports plain Markdown as not parsed', () => {
    expect(evaluate('# Just prose', 'a').parsed).toBe(false);
  });
});
