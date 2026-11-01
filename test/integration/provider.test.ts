import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
  FakePrompter,
  FakeProvider,
  SAMPLE_FILE,
  type ExplainResult,
  type PickerEntry,
  type TestApi,
} from './fakes';

let api: TestApi;
let a: FakeProvider;
let b: FakeProvider;
let picks: { title: string; entries: PickerEntry[] }[];
let answers: (string | undefined)[];

async function explain(): Promise<ExplainResult> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'typescript',
    content: SAMPLE_FILE,
  });
  await vscode.window.showTextDocument(doc);
  return vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
}

const config = () => vscode.workspace.getConfiguration('logiclens');

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !check(); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

suite('Provider choice', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
  });

  setup(async () => {
    a = new FakeProvider('fake-a', 'Fake A');
    a.state = { kind: 'not-installed', reason: 'Fake A is not installed.' };
    b = new FakeProvider('fake-b', 'Fake B');
    b.state = {
      kind: 'ready',
      models: [
        { id: 'b-small', label: 'B · Small' },
        { id: 'b-large', label: 'B · Large' },
      ],
    };
    api.setProviders([a, b]);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
    await api.globalState.update('providerChosen', true);
    picks = [];
    answers = [];
    api.setPick(async (entries, title) => {
      picks.push({ title, entries });
      return answers.shift();
    });
  });

  teardown(async () => {
    await config().update('provider', undefined, vscode.ConfigurationTarget.Global);
    await config().update('model', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('the picker lists providers by state, and picking one changes the next request', async () => {
    answers.push('fake-b', 'b-large');
    await vscode.commands.executeCommand('logiclens.selectProvider');
    const values = picks[0]?.entries.map((e) => (e.kind === 'item' ? e.value : `--${e.label}`));
    assert.deepStrictEqual(values, ['auto', '--Ready', 'fake-b', '--Not ready', 'fake-a']);
    assert.deepStrictEqual(
      picks[1]?.entries.map((e) => e.value),
      ['', 'b-small', 'b-large'],
    );
    assert.strictEqual(config().get('provider'), 'fake-b');
    assert.strictEqual(config().get('model'), 'b-large');

    assert.strictEqual((await explain()).kind, 'done');
    assert.strictEqual(b.requests[0]?.model, 'b-large');
    assert.strictEqual(a.requests.length, 0);
    await waitFor(() => api.statusText() === '$(sparkle) B · Large');
    assert.strictEqual(api.statusText(), '$(sparkle) B · Large');
  });

  test('a chosen provider that is not ready refuses and does not fall back', async () => {
    await config().update('provider', 'fake-a', vscode.ConfigurationTarget.Global);
    const result = await explain();
    assert.strictEqual(result.kind, 'refused');
    assert.strictEqual(result.reason, 'provider-unavailable');
    assert.strictEqual(a.requests.length + b.requests.length, 0);
    await waitFor(() => api.statusText() === '$(warning) LogicLens');
    assert.strictEqual(api.statusText(), '$(warning) LogicLens');
  });

  test('auto uses the first ready provider', async () => {
    assert.strictEqual((await explain()).kind, 'done');
    assert.strictEqual(b.requests[0]?.model, 'b-small');
  });

  test('Regenerate with… uses another model once and leaves settings alone', async () => {
    assert.strictEqual((await explain()).kind, 'done');
    answers.push(JSON.stringify(['fake-b', 'b-large']));
    const result = await vscode.commands.executeCommand<ExplainResult>('logiclens.regenerateWith');
    assert.strictEqual(result.kind, 'done');
    assert.deepStrictEqual(
      b.requests.map((r) => r.model),
      ['b-small', 'b-large'],
    );
    assert.strictEqual(config().get('provider'), 'auto');
  });

  test('first run with several ready providers asks before sending', async () => {
    a.state = { kind: 'ready', models: [{ id: 'a-1', label: 'A · One' }] };
    api.setProviders([a, b]);
    await api.globalState.update('providerChosen', undefined);
    answers.push('fake-b', '');
    assert.strictEqual((await explain()).kind, 'done');
    assert.strictEqual(picks[0]?.title, 'LogicLens: AI Provider');
    assert.strictEqual(a.requests.length, 0);
    assert.strictEqual(b.requests.length, 1);
  });

  test('Reset Data Notices shows the notice again on the next request', async () => {
    const prompter = new FakePrompter();
    api.setPrompter(prompter);
    await explain();
    await explain();
    assert.strictEqual(prompter.calls.filter((c) => c === 'notice').length, 0);
    await vscode.commands.executeCommand('logiclens.resetDataNotices');
    await explain();
    assert.strictEqual(prompter.calls.filter((c) => c === 'notice').length, 1);
  });
});
