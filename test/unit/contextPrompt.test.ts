import { describe, expect, it } from 'vitest';
import { buildFileContext, numberLines } from '../../src/explain/context';
import { explainMarkdownSystem, explainMarkdownUser } from '../../src/prompts/explainMarkdown';
import { scan, WITHHELD_MARKER } from '../../src/guard/secretScan';

describe('context builder', () => {
  it('numbers lines with equal-width padding', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `l${i + 1}`);
    const out = numberLines(lines).split('\n');
    expect(out[0]).toBe('   1│ l1');
    expect(out[9]).toBe('  10│ l10');
  });

  it('supports a first line offset', () => {
    expect(numberLines(['a'], 42)).toBe('  42│ a');
  });

  it('builds a header with path, language, and withheld lines', () => {
    const out = buildFileContext({
      path: 'src/a.ts',
      languageId: 'typescript',
      lines: ['const a = 1;', WITHHELD_MARKER],
      withheld: [2],
    });
    expect(out).toContain('File: src/a.ts');
    expect(out).toContain('Language: typescript');
    expect(out).toContain('Withheld lines: L2');
    expect(out).toContain(`  2│ ${WITHHELD_MARKER}`);
  });

  it('omits the withheld header when nothing was withheld', () => {
    expect(
      buildFileContext({ path: 'a', languageId: 'x', lines: ['a'], withheld: [] }),
    ).not.toContain('Withheld');
  });
});

describe('explain markdown prompt', () => {
  it('states the rules the spec requires', () => {
    const system = explainMarkdownSystem();
    expect(system).toMatch(/do not rewrite/i);
    expect(system).toContain(WITHHELD_MARKER);
    expect(system).toMatch(/Do not guess/);
    expect(system).toMatch(/No HTML/);
  });

  it('does not itself trip the secret scan', () => {
    const text = `${explainMarkdownSystem()}\n${explainMarkdownUser('x')}`;
    expect(scan(text.split('\n')).flagged).toEqual([]);
  });
});
