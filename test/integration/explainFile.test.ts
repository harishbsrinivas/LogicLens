import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FakePrompter, FakeProvider, SAMPLE_FILE, type ExplainResult, type TestApi } from './fakes';

const WITHHELD_MARKER = '«line withheld by LogicLens: possible secret»';
// Assembled at runtime so the repository never holds a whole key-shaped string.
const FAKE_AWS_KEY = ['AKIA', 'Q7RT2MZX4LNB8VHC'].join('');

let api: TestApi;
let provider: FakeProvider;
let prompter: FakePrompter;
let tmp: string;

async function openUntitled(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
  await vscode.window.showTextDocument(doc);
  return doc;
}

async function openFile(name: string, content: string): Promise<vscode.TextDocument> {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, content);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(doc);
  return doc;
}

function explain(): Thenable<ExplainResult> {
  return vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
}

function thread(doc: vscode.TextDocument) {
  return api.threads.snapshot(doc.uri);
}

suite('Explain File', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext, 'extension not found');
    api = (await ext.activate()) as TestApi;
    assert.ok(api, 'test API missing; is the host in test mode?');
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-'));
  });

  setup(async () => {
    provider = new FakeProvider();
    prompter = new FakePrompter();
    api.setProvider(provider);
    api.setPrompter(prompter);
    api.setTrusted(undefined);
    for (const key of api.globalState.keys()) {
      await api.globalState.update(key, undefined);
    }
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace
      .getConfiguration('logiclens')
      .update('secrets.action', undefined, vscode.ConfigurationTarget.Global);
  });

  test('registers the S1 commands and contributes no panel', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      'logiclens.explainFile',
      'logiclens.stop',
      'logiclens.closeExplanation',
      'logiclens.viewTerms',
    ]) {
      assert.ok(commands.includes(id), id);
    }
    assert.ok(!commands.includes('logiclens.hello'));
    assert.ok(!commands.includes('logiclens.panel.focus'));
  });

  test('streams the overview and summary into an inline thread at the top of the file', async () => {
    const doc = await openUntitled(SAMPLE_FILE);
    const result = await explain();
    assert.strictEqual(result.kind, 'done');
    const t = thread(doc);
    assert.ok(t, 'no inline thread');
    assert.strictEqual(t.line, 0);
    assert.match(t.body, /^Reads a config file and exposes the port\./);
    assert.match(t.body, /- Port comes from config\./);
    assert.match(t.body, /\*\*Things to watch\*\*\n\n- Throws if the file is missing\./);
    assert.deepStrictEqual(t.authors, ['LogicLens · Fake Provider · Fake Model', 'Summary']);
    assert.strictEqual(t.contextValue, 'finished');
    assert.ok(t.expanded);
    assert.match(t.commentLabel, /^\d+\.\ds$/);
    assert.match(provider.requests[0]?.system ?? '', /@@step/);
    assert.strictEqual(provider.requests.length, 1);
    assert.match(provider.requests[0]?.messages[0]?.text ?? '', /5│ export function port/);
    assert.deepStrictEqual(prompter.calls, ['notice']);
  });

  test('sends nothing until the terms are accepted', async () => {
    const doc = await openUntitled('const a = 1;\n');
    prompter.terms = async () => 'cancel';
    const refused = await explain();
    assert.strictEqual(refused.kind, 'refused');
    assert.strictEqual(refused.reason, 'terms');
    assert.strictEqual(provider.requests.length, 0);
    assert.strictEqual(provider.detectCalls, 0);
    assert.strictEqual(thread(doc), undefined);

    prompter.terms = async () => 'view';
    assert.strictEqual((await explain()).reason, 'terms');
    assert.deepStrictEqual(prompter.calls, ['openTerms']);

    prompter.terms = async () => 'agree';
    assert.strictEqual((await explain()).kind, 'done');
    assert.strictEqual(provider.requests.length, 1);
  });

  test('Stop keeps the partial text and marks it stopped', async () => {
    const doc = await openUntitled('const a = 1;\n');
    provider.hold = true;
    const running = explain();
    await provider.firstChunkSent;
    assert.strictEqual(thread(doc)?.contextValue, 'streaming');
    await vscode.commands.executeCommand('logiclens.stop');
    const result = await running;
    assert.strictEqual(result.kind, 'stopped');
    const t = thread(doc);
    assert.strictEqual(t?.contextValue, 'finished');
    assert.match(t?.label ?? '', /stopped/);
    assert.strictEqual(
      t?.body,
      'Reads a config file and exposes the port.\n\n*Stopped. The explanation above is partial.*',
    );
  });

  test('Close Explanation removes the inline thread', async () => {
    const doc = await openUntitled('const a = 1;\n');
    assert.strictEqual((await explain()).kind, 'done');
    assert.ok(thread(doc));
    await vscode.commands.executeCommand('logiclens.closeExplanation');
    assert.strictEqual(thread(doc), undefined);
  });

  test('shows unstructured output as safe plain Markdown with a notice', async () => {
    const doc = await openUntitled('const a = 1;\n');
    provider.chunks = [
      '[run](command:workbench.action.terminal.new) ![x](https://example.com/a.png) <b>b</b>',
    ];
    assert.strictEqual((await explain()).kind, 'done');
    assert.strictEqual(
      thread(doc)?.body,
      '> Shown as plain text: the model did not return steps.\n\n' +
        'run [x](https://example.com/a.png) <b>b</b>',
    );
    assert.deepStrictEqual(api.threads.stepSnapshots(doc.uri), []);
  });

  test('refuses excluded files', async () => {
    const doc = await openFile('.env', 'NAME=value\n');
    const result = await explain();
    assert.strictEqual(result.kind, 'refused');
    assert.strictEqual(result.reason, 'excluded');
    assert.strictEqual(provider.requests.length, 0);
    assert.strictEqual(thread(doc), undefined);
  });

  test('refuses in an untrusted workspace', async () => {
    await openUntitled('const a = 1;\n');
    api.setTrusted(false);
    const result = await explain();
    assert.strictEqual(result.reason, 'untrusted');
    assert.strictEqual(provider.requests.length, 0);
  });

  test('withholds a line with a possible secret and sends the rest', async () => {
    const doc = await openUntitled(
      `const a = 1;\nconst b = 2;\nconst id = '${FAKE_AWS_KEY}';\nconst c = 3;\n`,
    );
    const result = await explain();
    assert.strictEqual(result.kind, 'done');
    const sent = JSON.stringify(provider.requests);
    assert.ok(!sent.includes(FAKE_AWS_KEY), 'secret was sent');
    assert.ok(sent.includes(`3│ ${WITHHELD_MARKER}`));
    const body = thread(doc)?.body ?? '';
    assert.match(body, /^> 1 line withheld: possible secret on L3\n/);
    assert.ok(!body.includes(FAKE_AWS_KEY));
  });

  test('refuse-file sends nothing and lists the lines', async () => {
    await vscode.workspace
      .getConfiguration('logiclens')
      .update('secrets.action', 'refuse-file', vscode.ConfigurationTarget.Global);
    await openUntitled(`const a = 1;\nconst b = 2;\nconst c = 3;\nconst id = '${FAKE_AWS_KEY}';\n`);
    const result = await explain();
    assert.strictEqual(result.reason, 'secrets');
    assert.deepStrictEqual(result.lines, [4]);
    assert.strictEqual(provider.requests.length, 0);
  });

  test('never sends on open, switch, edit, or save', async () => {
    await api.globalState.update('termsAccepted', undefined);
    const a = await openFile('a.ts', 'export const a = 1;\n');
    await openFile('b.ts', 'export const b = 2;\n');
    await vscode.window.showTextDocument(a);
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), '// edited\n'));
    await a.save();
    await openUntitled('const u = 1;\n');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(provider.requests.length, 0);
    assert.strictEqual(provider.detectCalls, 0);
    assert.deepStrictEqual(prompter.calls, []);
  });
});
