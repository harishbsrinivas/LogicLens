import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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
let provider: FakeProvider;
let picks: { title: string; entries: PickerEntry[] }[];
let answers: (string | undefined)[];
let tmp: string;

const config = () => vscode.workspace.getConfiguration('logiclens');
const sent = () => provider.requests.at(-1)?.messages.at(-1)?.text ?? '';
const system = () => provider.requests.at(-1)?.system ?? '';

async function openSample(language = 'typescript'): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ language, content: SAMPLE_FILE });
  return vscode.window.showTextDocument(doc);
}

function select(editor: vscode.TextEditor, from: number, to: number): void {
  editor.selection = new vscode.Selection(from - 1, 0, to - 1, 1);
}

suite('Targets and controls', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-t-'));
  });

  setup(async () => {
    provider = new FakeProvider();
    api.setProvider(provider);
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
    for (const key of ['maxLines', 'depth', 'audience', 'codeLens.enabled']) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('Explain Selection sends the selection marked, with the file as context', async () => {
    const editor = await openSample();
    select(editor, 5, 8);
    const result = await vscode.commands.executeCommand<ExplainResult>(
      'logiclens.explainSelection',
    );
    assert.strictEqual(result.kind, 'done');
    assert.ok(sent().startsWith('Walk me through L5-L8, the lines between the markers.'));
    assert.ok(sent().includes('Target: L5-L8'));
    assert.ok(sent().includes('<<<TARGET\n  5│ export function port(): number {'));
    const overview = api.threads.snapshot(editor.document.uri);
    // The overview sits just above the selection, labelled with its lines.
    assert.strictEqual(overview?.line, 3);
    assert.ok(overview?.label.includes('L5–8'));
    // Step 2 of the sample (L1-L3) is outside the target, so it is not tied to lines.
    assert.deepStrictEqual(
      api.threads.stepSnapshots(editor.document.uri).map((s) => s.index),
      [0],
    );
  });

  test('Explain again keeps the selection target', async () => {
    const editor = await openSample();
    select(editor, 5, 8);
    await vscode.commands.executeCommand('logiclens.explainSelection');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await vscode.commands.executeCommand('logiclens.explainFile', { uri: editor.document.uri });
    assert.ok(sent().includes('Target: L5-L8'));
  });

  test('the Explorer command opens the file and explains it', async () => {
    const file = path.join(tmp, 'port.ts');
    fs.writeFileSync(file, SAMPLE_FILE);
    const result = await vscode.commands.executeCommand<ExplainResult>(
      'logiclens.explainFile',
      vscode.Uri.file(file),
    );
    assert.strictEqual(result.kind, 'done');
    assert.strictEqual(vscode.window.activeTextEditor?.document.uri.fsPath, file);
    assert.ok(sent().startsWith('Walk me through this file.'));
  });

  test('a file over the line limit offers the selection, visible range, or a symbol', async () => {
    await config().update('maxLines', 5, vscode.ConfigurationTarget.Global);
    const editor = await openSample();
    select(editor, 2, 3);
    answers.push('selection');
    const result = await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
    assert.strictEqual(result.kind, 'done');
    assert.deepStrictEqual(
      picks[0]?.entries.map((e) => e.value),
      ['selection', 'visible', 'symbol'],
    );
    assert.ok(sent().includes('Target: L2-L3'));
  });

  test('Set Depth saves the setting and regenerates with it', async () => {
    const editor = await openSample();
    await vscode.commands.executeCommand('logiclens.explainFile');
    answers.push('overview');
    await vscode.commands.executeCommand('logiclens.setDepth', { uri: editor.document.uri });
    assert.strictEqual(config().get('depth'), 'overview');
    assert.strictEqual(provider.requests.length, 2);
    assert.ok(system().includes('Depth: overview'));
  });

  test('answers follow the audience setting', async () => {
    await config().update('audience', 'eli5', vscode.ConfigurationTarget.Global);
    const editor = await openSample();
    editor.selection = new vscode.Selection(1, 0, 1, 0);
    const thread =
      await vscode.commands.executeCommand<vscode.CommentThread>('logiclens.askAtLine');
    await vscode.commands.executeCommand('logiclens.submitQuestion', { thread, text: 'why?' });
    assert.ok(system().includes("Audience: explain like I'm five"));
    await vscode.commands.executeCommand('logiclens.clearAllThreads');
  });

  test('the Explain CodeLens appears only when enabled and explains that symbol', async () => {
    const registration = vscode.languages.registerDocumentSymbolProvider('plaintext', {
      provideDocumentSymbols: () => [
        new vscode.DocumentSymbol(
          'port',
          '',
          vscode.SymbolKind.Function,
          new vscode.Range(4, 0, 7, 1),
          new vscode.Range(4, 16, 4, 20),
        ),
      ],
    });
    try {
      const editor = await openSample('plaintext');
      const explainLenses = async () =>
        (
          await vscode.commands.executeCommand<vscode.CodeLens[]>(
            'vscode.executeCodeLensProvider',
            editor.document.uri,
          )
        ).filter((l) => l.command?.command === 'logiclens.explainSymbol');
      assert.strictEqual((await explainLenses()).length, 0);
      await config().update('codeLens.enabled', true, vscode.ConfigurationTarget.Global);
      const [lens] = await explainLenses();
      assert.ok(lens?.command);
      assert.strictEqual(lens.range.start.line, 4);
      const result = await vscode.commands.executeCommand<ExplainResult>(
        lens.command.command,
        ...(lens.command.arguments ?? []),
      );
      assert.strictEqual(result.kind, 'done');
      assert.ok(sent().includes('Target: L5-L8'));
    } finally {
      registration.dispose();
    }
  });
});
