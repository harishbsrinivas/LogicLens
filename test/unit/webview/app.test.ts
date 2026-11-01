// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostToWebviewMessage, PanelState, WalkthroughView } from '../../../shared/messages';

const SESSION = 's1';
let posted: { type: string; sessionId: string }[];
let svelte: typeof import('svelte');
let app: ReturnType<typeof svelte.mount> | undefined;

async function start(): Promise<void> {
  document.body.innerHTML = `<div id="root" data-session="${SESSION}"></div>`;
  posted = [];
  vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: (m: { type: string; sessionId: string }) => posted.push(m),
  }));
  // Fresh modules each test (the bridge reads the session ID on import); import Svelte after
  // the reset so the component and the test share one runtime.
  vi.resetModules();
  svelte = await import('svelte');
  const { default: App } = await import('../../../webview/src/App.svelte');
  const target = document.getElementById('root');
  if (!target) throw new Error('no root');
  app = svelte.mount(App, { target });
  svelte.flushSync();
}

type Payload<T> = T extends unknown ? Omit<T, 'sessionId'> : never;

function receive(message: Payload<HostToWebviewMessage>): void {
  window.dispatchEvent(new MessageEvent('message', { data: { ...message, sessionId: SESSION } }));
  svelte.flushSync();
}

function walkthrough(overrides: Partial<WalkthroughView> = {}): PanelState {
  return {
    kind: 'walkthrough',
    focus: null,
    walkthrough: {
      id: 'w1',
      fileName: 'a.ts',
      providerLabel: 'VS Code Language Models',
      model: 'copilot · GPT',
      status: 'streaming',
      overview: '',
      steps: [],
      summary: '',
      watch: '',
      fallbackMarkdown: '',
      notice: null,
      error: null,
      durationMs: null,
      withheld: [],
      stale: false,
      ...overrides,
    },
  };
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

describe('panel app', () => {
  beforeEach(start);
  afterEach(() => {
    if (app) svelte.unmount(app);
    vi.unstubAllGlobals();
  });

  it('says ready with the session ID', () => {
    expect(posted).toEqual([{ type: 'ready', sessionId: SESSION }]);
  });

  it('shows the terms state with Review Terms', () => {
    receive({ type: 'state', state: { kind: 'empty', fileName: 'a.ts', termsAccepted: false } });
    expect(document.body.textContent).toContain('Accept the LogicLens terms of use to continue.');
    button('Review Terms').click();
    expect(posted.at(-1)).toEqual({ type: 'viewTerms', sessionId: SESSION });
  });

  it('shows the empty state with Explain this file', () => {
    receive({ type: 'state', state: { kind: 'empty', fileName: 'a.ts', termsAccepted: true } });
    button('Explain this file').click();
    expect(posted.at(-1)).toEqual({ type: 'explain', sessionId: SESSION });
  });

  it('shows the excluded state without explain actions', () => {
    receive({ type: 'state', state: { kind: 'excluded', fileName: '.env' } });
    expect(document.body.textContent).toContain('Excluded by LogicLens settings');
    expect(document.querySelectorAll('button')).toHaveLength(0);
  });

  it('streams Markdown, offers Stop, then shows the footer when done', () => {
    receive({ type: 'state', state: walkthrough() });
    receive({ type: 'markdownDelta', wid: 'w1', text: '## Part\n\nUses `x`.' });
    receive({ type: 'markdownDelta', wid: 'other', text: 'ignored' });
    expect(document.querySelector('.content h2')?.textContent).toBe('Part');
    expect(document.body.textContent).not.toContain('ignored');
    button('Stop').click();
    expect(posted.at(-1)).toEqual({ type: 'stop', sessionId: SESSION });

    receive({
      type: 'state',
      state: walkthrough({ status: 'done', fallbackMarkdown: '## Part', durationMs: 4200 }),
    });
    expect(document.querySelector('footer')?.textContent).toContain(
      'VS Code Language Models · copilot · GPT · 4.2s',
    );
    expect(document.querySelector('[aria-live]')?.textContent).toBe('Explanation finished.');
  });

  it('marks stopped and failed explanations', () => {
    receive({ type: 'state', state: walkthrough({ status: 'stopped', fallbackMarkdown: 'Half' }) });
    expect(document.body.textContent).toContain('Stopped. The explanation above is partial.');
    receive({ type: 'state', state: walkthrough({ status: 'failed', error: 'Quota hit.' }) });
    expect(document.querySelector('[role=alert]')?.textContent).toBe('Quota hit.');
  });

  it('lists withheld lines as links that reveal the line', () => {
    receive({ type: 'state', state: walkthrough({ status: 'done', withheld: [12, 40] }) });
    expect(document.querySelector('.notice')?.textContent).toContain(
      '2 lines withheld: possible secrets on',
    );
    button('L40').click();
    expect(posted.at(-1)).toEqual({ type: 'revealLine', line: 40, sessionId: SESSION });
  });

  it('routes link clicks through the host', () => {
    receive({
      type: 'state',
      state: walkthrough({ status: 'done', fallbackMarkdown: '[docs](https://example.com)' }),
    });
    document.querySelector<HTMLAnchorElement>('.content a')?.click();
    expect(posted.at(-1)).toEqual({
      type: 'openLink',
      href: 'https://example.com',
      sessionId: SESSION,
    });
  });
});
