// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../../webview/src/markdown';

describe('webview Markdown rendering', () => {
  it('renders ordinary Markdown', () => {
    const html = renderMarkdown('# Title\n\nSome `code` and **bold**.\n\n- a\n- b');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>a</li>');
  });

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="#" onclick="alert(1)">x</a>',
    '<iframe src="https://example.com"></iframe>',
    '<style>body{display:none}</style>',
  ])('never emits raw HTML from %s', (input) => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown(input);
    expect(root.querySelector('script, img, iframe, style')).toBeNull();
    const attrs = [...root.querySelectorAll('*')].flatMap((el) => el.getAttributeNames());
    expect(attrs.filter((a) => a.startsWith('on'))).toEqual([]);
    // The input survives only as visible text.
    expect(root.textContent).toContain(input.slice(1, 6));
  });

  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](command:workbench.action.terminal.new)',
    '[x](vscode://file/etc/passwd)',
  ])('drops unsafe link targets in %s', (input) => {
    const html = renderMarkdown(input);
    expect(html).not.toMatch(/href="(?!https?:)/i);
  });

  it('keeps https links', () => {
    expect(renderMarkdown('[docs](https://example.com)')).toContain('href="https://example.com"');
  });

  it('drops images even with https sources', () => {
    expect(renderMarkdown('![x](https://example.com/a.png)')).not.toContain('<img');
  });
});
