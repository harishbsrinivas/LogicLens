import { describe, expect, it } from 'vitest';
import { safeMarkdown } from '../../src/ui/safeMarkdown';

describe('safe Markdown for editor comments', () => {
  it('leaves ordinary Markdown alone', () => {
    const text = '# Title\n\nSome `code` and **bold**.\n\n- a\n- b\n\nSee L12-L20.';
    expect(safeMarkdown(text)).toBe(text);
  });

  it('keeps http and https links', () => {
    expect(safeMarkdown('[docs](https://example.com/a "t")')).toBe(
      '[docs](https://example.com/a "t")',
    );
    expect(safeMarkdown('<http://example.com>')).toBe('<http://example.com>');
  });

  it.each([
    ['[x](javascript:alert(1))', 'x)'],
    ['[x](JaVaScRiPt:alert)', 'x'],
    ['[x](data:text/html;base64,PHNjcmlwdD4=)', 'x'],
    ['[x](command:workbench.action.terminal.new)', 'x'],
    ['[x](vscode://file/etc/passwd)', 'x'],
    ['[x](file:///etc/passwd)', 'x'],
    ['[x](<command:a>)', 'x'],
    ['[x](./relative.md)', 'x'],
  ])('drops the target of %s', (input, expected) => {
    expect(safeMarkdown(input)).toBe(expected);
  });

  it('drops reference definitions that are not http(s)', () => {
    expect(safeMarkdown('[x][r]\n\n[r]: command:workbench.action.terminal.new')).toBe('[x][r]\n\n');
    expect(safeMarkdown('[r]: https://example.com')).toBe('[r]: https://example.com');
  });

  it('turns non-http autolinks into code', () => {
    expect(safeMarkdown('<command:workbench.action.terminal.new>')).toBe(
      '`command:workbench.action.terminal.new`',
    );
  });

  it('turns images into links so nothing loads on render', () => {
    expect(safeMarkdown('![x](https://example.com/a.png?d=secret)')).toBe(
      '[x](https://example.com/a.png?d=secret)',
    );
    expect(safeMarkdown('![x][r]\n\n[r]: https://example.com/a.png')).toBe(
      '[x][r]\n\n[r]: https://example.com/a.png',
    );
    expect(safeMarkdown('![x](data:image/png;base64,AAAA)')).toBe('x');
  });
});
