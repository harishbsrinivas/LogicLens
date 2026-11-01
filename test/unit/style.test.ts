import { describe, expect, it } from 'vitest';
import { contextWindow } from '../../src/explain/context';
import { ProtocolParser } from '../../src/explain/protocol';
import { questionSystem } from '../../src/prompts/question';
import {
  AUDIENCES,
  DEFAULT_STYLE,
  DEPTHS,
  effectiveJargon,
  JARGONS,
  styleRules,
  type ExplanationStyle,
} from '../../src/prompts/style';
import {
  walkthroughSystem,
  walkthroughUser,
  WALKTHROUGH_VERSION,
} from '../../src/prompts/walkthrough';

const lines = (n: number, width = 9) =>
  Array.from({ length: n }, (_, i) => `l${i + 1}`.padEnd(width, 'x'));

describe('context window', () => {
  it('sends a small file whole', () => {
    expect(contextWindow(lines(50), { start: 20, end: 22 }, 10_000, 2000)).toEqual({
      start: 1,
      end: 50,
    });
  });

  it('keeps the target whole even over budget', () => {
    expect(contextWindow(lines(50), { start: 10, end: 40 }, 10, 2000)).toEqual({
      start: 10,
      end: 40,
    });
  });

  it('takes the enclosing symbol, then grows outward evenly', () => {
    // 10 characters per line; budget for 30 lines.
    expect(
      contextWindow(lines(1000), { start: 500, end: 501 }, 300, 2000, { start: 495, end: 510 }),
    ).toEqual({
      start: 488,
      end: 517,
    });
  });

  it('never exceeds maxLines', () => {
    const w = contextWindow(lines(1000), { start: 500, end: 500 }, 1_000_000, 101);
    expect(w.end - w.start + 1).toBe(101);
  });
});

describe('style rules', () => {
  it('jargon auto follows the audience', () => {
    expect(effectiveJargon({ audience: 'eli5', jargon: 'auto' })).toBe('avoid');
    expect(effectiveJargon({ audience: 'newcomer', jargon: 'auto' })).toBe('define');
    expect(effectiveJargon({ audience: 'expert', jargon: 'auto' })).toBe('use');
    expect(effectiveJargon({ audience: 'expert', jargon: 'define' })).toBe('define');
  });

  it('eli5 asks for an analogy without replacing what the code does', () => {
    const rules = styleRules({ ...DEFAULT_STYLE, audience: 'eli5' }, true).join('\n');
    expect(rules).toMatch(/analogy/);
    expect(rules).toMatch(/never replaces/);
    expect(rules).toMatch(/avoid technical terms/);
  });

  it('names the step range for each depth and the language', () => {
    const style = (depth: ExplanationStyle['depth']) =>
      styleRules({ ...DEFAULT_STYLE, depth, language: 'de' }, true).join('\n');
    expect(style('overview')).toContain('3 to 5 steps');
    expect(style('detailed')).toContain('8 to 25 steps');
    expect(style('standard')).toContain('"de"');
    expect(style('standard')).toMatch(/never translate/);
  });

  it('questions follow audience and jargon but not depth', () => {
    const q = questionSystem({ ...DEFAULT_STYLE, depth: 'detailed', audience: 'expert' });
    expect(q).toContain('Audience: an expert');
    expect(q).not.toContain('Depth:');
  });

  it('every combination keeps a format the parser accepts', () => {
    expect(WALKTHROUGH_VERSION).toBe(2);
    for (const depth of DEPTHS) {
      for (const audience of AUDIENCES) {
        for (const jargon of JARGONS) {
          const system = walkthroughSystem({ depth, audience, jargon, language: 'en' });
          const example = system.slice(system.indexOf('@@overview'), system.indexOf('@@end') + 5);
          const p = new ProtocolParser();
          p.push(example);
          p.finish();
          expect(p.ended).toBe(true);
        }
      }
    }
  });

  it('asks only for the target lines when there is one', () => {
    expect(walkthroughUser('CTX', { start: 12, end: 40 })).toBe(
      'Walk me through L12-L40, the lines between the markers.\n\nCTX',
    );
    expect(walkthroughSystem()).toContain('<<<TARGET');
  });
});
