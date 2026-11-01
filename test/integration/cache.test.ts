import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FakePrompter, FakeProvider, SAMPLE_FILE, type ExplainResult, type TestApi } from './fakes';

let api: TestApi;
let provider: FakeProvider;
let tmp: string;
let n = 0;

const config = () => vscode.workspace.getConfiguration('logiclens');

async function explainNewFile(): Promise<vscode.TextEditor> {
  const file = path.join(tmp, `cached${++n}.ts`);
  fs.writeFileSync(file, SAMPLE_FILE);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  const editor = await vscode.window.showTextDocument(doc);
  const result = await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
  assert.strictEqual(result.kind, 'done');
  return editor;
}

/** Saves, then forgets everything in memory, as closing and reopening VS Code would. */
async function reload(doc: vscode.TextDocument): Promise<boolean> {
  await api.cache.flush();
  api.dropState(doc.uri);
  return api.cache.restore(doc);
}

suite('Cache and staleness', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-c-'));
  });

  setup(async () => {
    provider = new FakeProvider();
    api.setProvider(provider);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
    await api.globalState.update('providerChosen', true);
  });

  teardown(async () => {
    await config().update('cache.enabled', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('logiclens.clearAllThreads');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('a reopened file shows its walkthrough and threads without a new request', async () => {
    const editor = await explainNewFile();
    editor.selection = new vscode.Selection(1, 0, 1, 0);
    const thread =
      await vscode.commands.executeCommand<vscode.CommentThread>('logiclens.askAtLine');
    provider.queued.push(['It reads the file.']);
    await vscode.commands.executeCommand('logiclens.submitQuestion', { thread, text: 'what?' });
    const requests = provider.requests.length;

    assert.strictEqual(await reload(editor.document), true);
    assert.strictEqual(provider.requests.length, requests);
    const overview = api.threads.snapshot(editor.document.uri);
    assert.strictEqual(overview?.commentLabel, 'Generated just now');
    assert.deepStrictEqual(
      api.threads.stepSnapshots(editor.document.uri).map((s) => s.line),
      [3, 0],
    );
    const [q] = api.questions.snapshots(editor.document.uri);
    assert.strictEqual(q?.line, 1);
    assert.strictEqual(q?.comments[1]?.body, 'It reads the file.');
  });

  test('restoring after the code changed follows moved steps and marks changed ones', async () => {
    const editor = await explainNewFile();
    await api.cache.flush();
    api.dropState(editor.document.uri);
    // Two lines above everything, and step 2's code (L1-L3) rewritten.
    await editor.edit((b) => {
      b.replace(new vscode.Range(0, 0, 0, 39), 'import { readFile } from "node:fs/promises";');
      b.insert(new vscode.Position(0, 0), '// a\n// b\n');
    });
    assert.strictEqual(await api.cache.restore(editor.document), true);
    const steps = api.threads.stepSnapshots(editor.document.uri);
    assert.deepStrictEqual(
      steps.map((s) => [s.index, s.line, s.label]),
      [
        [0, 5, '1 · Resolve the port'],
        [1, 0, '2 · Load the config (code changed)'],
      ],
    );
    assert.strictEqual(api.threads.snapshot(editor.document.uri)?.contextValue, 'stale-steps');
  });

  test('edits move steps live, and Refresh Changed Steps rewrites only the changed ones', async () => {
    const editor = await explainNewFile();
    await editor.edit((b) => b.insert(new vscode.Position(0, 0), '// a\n// b\n'));
    assert.deepStrictEqual(
      api.threads.stepSnapshots(editor.document.uri).map((s) => s.line),
      [5, 1],
    );
    // Edit inside step 1 (now L7-L10).
    await editor.edit((b) => b.insert(new vscode.Position(8, 0), '  // why\n'));
    let steps = api.threads.stepSnapshots(editor.document.uri);
    assert.strictEqual(steps[0]?.label, '1 · Resolve the port (code changed)');
    assert.strictEqual(steps[1]?.label, '2 · Load the config');

    provider.queued.push([
      '@@step 1 | L7-L11 | Resolve the port again\nStill 8080 by default.\n@@end\n',
    ]);
    const result = await vscode.commands.executeCommand<ExplainResult>('logiclens.refreshChanged');
    assert.strictEqual(result.kind, 'done');
    const sent = provider.requests.at(-1)?.messages[0]?.text ?? '';
    assert.ok(sent.includes('- Step 1 (was L7-L11): Resolve the port'));
    assert.ok(!sent.includes('- Step 2'));
    steps = api.threads.stepSnapshots(editor.document.uri);
    assert.strictEqual(steps[0]?.label, '1 · Resolve the port again');
    assert.ok(steps[0]?.body.startsWith('Still 8080 by default.'));
    assert.strictEqual(steps[1]?.label, '2 · Load the config');
    // Nothing is marked any more, so the walkthrough is no longer stale.
    assert.strictEqual(api.threads.snapshot(editor.document.uri)?.contextValue, 'finished');
  });

  test('nothing is restored with the cache off, and Clear Cache deletes entries', async () => {
    const editor = await explainNewFile();
    await api.cache.flush();
    await config().update('cache.enabled', false, vscode.ConfigurationTarget.Global);
    assert.strictEqual(await reload(editor.document), false);
    await config().update('cache.enabled', undefined, vscode.ConfigurationTarget.Global);
    assert.strictEqual(await api.cache.restore(editor.document), true);
    await vscode.commands.executeCommand('logiclens.clearCache');
    api.dropState(editor.document.uri);
    assert.strictEqual(await api.cache.restore(editor.document), false);
  });

  test('Close Explanation also removes the cached walkthrough', async () => {
    const editor = await explainNewFile();
    await api.cache.flush();
    await vscode.commands.executeCommand('logiclens.closeExplanation');
    await api.cache.flush();
    assert.strictEqual(await api.cache.restore(editor.document), false);
  });
});
