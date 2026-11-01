import { describe, expect, it } from 'vitest';
import { isAllowedLink, parseWebviewMessage } from '../../src/ui/validate';

const S = 'session-1';

describe('webview message validation', () => {
  it('accepts known messages for the current session', () => {
    expect(parseWebviewMessage({ type: 'ready', sessionId: S }, S)).toEqual({
      type: 'ready',
      sessionId: S,
    });
    expect(parseWebviewMessage({ type: 'revealLine', sessionId: S, line: 3, x: 1 }, S)).toEqual({
      type: 'revealLine',
      sessionId: S,
      line: 3,
    });
  });

  it.each([
    null,
    'ready',
    { type: 'ready' },
    { type: 'ready', sessionId: 'old' },
    { type: 'runCommand', sessionId: S },
    { type: 'revealLine', sessionId: S, line: 0 },
    { type: 'revealLine', sessionId: S, line: 1.5 },
    { type: 'revealLine', sessionId: S, line: '3' },
    { type: 'focusStep', sessionId: S, index: -1 },
    { type: 'openLink', sessionId: S, href: 'javascript:alert(1)' },
    { type: 'openLink', sessionId: S, href: 'command:workbench.action.terminal.new' },
    { type: 'openLink', sessionId: S, href: 'file:///etc/passwd' },
  ])('drops %j', (raw) => {
    expect(parseWebviewMessage(raw, S)).toBeUndefined();
  });

  it('allows only http and https links', () => {
    expect(isAllowedLink('https://example.com/a')).toBe(true);
    expect(isAllowedLink('http://example.com')).toBe(true);
    expect(isAllowedLink('vscode://file/x')).toBe(false);
    expect(isAllowedLink('https://')).toBe(false);
  });
});
