import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { FakeProvider, type TestApi } from './fakes';

let api: TestApi;
const config = () => vscode.workspace.getConfiguration('logiclens');

interface StateMessage {
  type: 'state';
  state: {
    settings: { key: string; value: unknown; isDefault: boolean }[];
    providers: { id: string; state: string; models: { id: string }[] }[];
  };
}

function lastState(): StateMessage['state'] {
  const states = api.settings.sent.filter(
    (m): m is StateMessage => (m as { type?: string }).type === 'state',
  );
  const last = states.at(-1);
  assert.ok(last, 'no state was posted');
  return last.state;
}

suite('Settings page', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
  });

  setup(() => {
    const p = new FakeProvider();
    api.setProvider(p);
  });

  teardown(async () => {
    for (const key of ['depth', 'focusDimming', 'exclude', 'cli.claudePath']) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('opens as a webview with a nonce CSP and only local scripts and styles', async () => {
    await vscode.commands.executeCommand('logiclens.openSettings');
    const html = api.settings.html;
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
    assert.ok(csp.startsWith("default-src 'none'"), csp);
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    assert.ok(nonce && nonce.length >= 16);
    assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
    // Every source is a keyword, the nonce, or VS Code's own webview resource origin.
    for (const token of csp.split(/[;\s]+/).filter((t) => t && !t.endsWith('-src'))) {
      assert.ok(
        /^'(none|self|nonce-[^']+)'$/.test(token) || /vscode-(cdn|resource|webview)/.test(token),
        `unexpected CSP source ${token}`,
      );
    }
    // One script, from the extension, carrying the nonce; no inline script bodies.
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    assert.strictEqual(scripts.length, 1);
    assert.ok(scripts[0]?.includes(`nonce="${nonce}"`) && scripts[0]?.includes('settings.js'));
    assert.ok(/<script[^>]*><\/script>/.test(html));
    // The real page script loads under this CSP, runs, and asks for its state.
    const posted = () => api.settings.sent.some((m) => (m as { type?: string }).type === 'state');
    for (let i = 0; i < 100 && !posted(); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(posted(), 'the page script never sent ready');
    // A second open reuses the panel and gets a fresh page only once.
    await vscode.commands.executeCommand('logiclens.openSettings');
    assert.strictEqual(api.settings.html, html);
  });

  test('a valid change is written to user settings and the new state is posted', async () => {
    api.settings.show();
    await api.settings.receive({ type: 'ready' });
    assert.ok(lastState().providers.some((p) => p.id === 'fake' && p.state === 'Ready'));
    await api.settings.receive({ type: 'set', key: 'depth', value: 'detailed' });
    assert.strictEqual(config().inspect('depth')?.globalValue, 'detailed');
    assert.deepStrictEqual(
      lastState().settings.find((s) => s.key === 'depth'),
      {
        ...lastState().settings.find((s) => s.key === 'depth'),
        value: 'detailed',
        isDefault: false,
      },
    );
    await api.settings.receive({ type: 'set', key: 'exclude', value: ['**/.env*', 'secrets/**'] });
    assert.deepStrictEqual(config().inspect('exclude')?.globalValue, ['**/.env*', 'secrets/**']);
    await api.settings.receive({ type: 'reset', key: 'depth' });
    assert.strictEqual(config().inspect('depth')?.globalValue, undefined);
  });

  test('invalid messages change nothing and report an error', async () => {
    api.settings.show();
    const before = api.settings.sent.length;
    await api.settings.receive({ type: 'set', key: 'depth', value: 'everything' });
    await api.settings.receive({ type: 'set', key: 'unknown.key', value: true });
    await api.settings.receive({
      type: 'set',
      key: 'cli.claudePath',
      value: 'claude\n--tools all',
    });
    await api.settings.receive({ type: 'action', name: 'constructor' });
    await api.settings.receive({ type: 'action', name: 'workbench.action.terminal.new' });
    await api.settings.receive('not an object');
    assert.strictEqual(config().inspect('depth')?.globalValue, undefined);
    assert.strictEqual(config().inspect('cli.claudePath')?.globalValue, undefined);
    const errors = api.settings.sent
      .slice(before)
      .filter((m) => (m as { type?: string }).type === 'error');
    assert.strictEqual(errors.length, 3);
  });

  test('buttons run only their own LogicLens commands', async () => {
    api.settings.show();
    await api.globalState.update('dataNotice.fake', 'x');
    await api.settings.receive({ type: 'action', name: 'resetDataNotices' });
    assert.strictEqual(api.globalState.get('dataNotice.fake'), undefined);
  });
});
