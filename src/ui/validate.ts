// Validates messages from the webview before the host acts on them (arch §6, §8). Pure.
import type { WebviewToHostMessage } from '../../shared/messages';

const NO_PAYLOAD = new Set(['ready', 'explain', 'continue', 'stop', 'viewTerms']);
const ALLOWED_LINK = /^https?:\/\//i;

export function parseWebviewMessage(
  raw: unknown,
  sessionId: string,
): WebviewToHostMessage | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const msg = raw as Record<string, unknown>;
  if (msg.sessionId !== sessionId || typeof msg.type !== 'string') {
    return undefined;
  }
  if (NO_PAYLOAD.has(msg.type)) {
    return { type: msg.type, sessionId } as WebviewToHostMessage;
  }
  switch (msg.type) {
    case 'focusStep':
      return isIndex(msg.index) ? { type: 'focusStep', sessionId, index: msg.index } : undefined;
    case 'revealLine':
      return isIndex(msg.line) && msg.line >= 1
        ? { type: 'revealLine', sessionId, line: msg.line }
        : undefined;
    case 'openLink':
      return typeof msg.href === 'string' && isAllowedLink(msg.href)
        ? { type: 'openLink', sessionId, href: msg.href }
        : undefined;
    default:
      return undefined;
  }
}

export function isAllowedLink(href: string): boolean {
  if (!ALLOWED_LINK.test(href)) {
    return false;
  }
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
