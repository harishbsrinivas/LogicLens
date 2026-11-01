import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FakePrompter, FakeProvider, SAMPLE_FILE, type TestApi } from './fakes';

let api: TestApi;
let provider: FakeProvider;
let tmp: string;
let notes: (string | undefined)[];
let n = 0;

async function openFile(content = SAMPLE_FILE, name = `bm${++n}.ts`): Promise<vscode.TextEditor> {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, content);
  return vscode.window.showTextDocument(
    await vscode.workspace.openTextDocument(vscode.Uri.file(file)),
  );
}

suite('Bookmarks', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-b-'));
  });

  setup(async () => {
    provider = new FakeProvider();
    api.setProvider(provider);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
    await api.globalState.update('providerChosen', true);
    await api.bookmarks.clear();
    notes = [];
    api.setInput(async () => notes.shift());
  });

  teardown(async () => {
    await vscode.commands.executeCommand('logiclens.clearAllThreads');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('bookmarks a step, an answer, and code, each with a copy of its text', async () => {
    const editor = await openFile();
    await vscode.commands.executeCommand('logiclens.explainFile');
    const key = editor.document.uri.toString();
    notes.push('retry rule');
    await vscode.commands.executeCommand('logiclens.bookmarkStep', key, 0);

    editor.selection = new vscode.Selection(1, 0, 1, 0);
    const thread =
      await vscode.commands.executeCommand<vscode.CommentThread>('logiclens.askAtLine');
    provider.queued.push(['Parses JSON.']);
    const asked = await vscode.commands.executeCommand<{ threadId: string }>(
      'logiclens.submitQuestion',
      { thread, text: 'why?' },
    );
    const answer = api.questions.comments(asked.threadId).find((c) => c.part === 'answer');
    notes.push('');
    await vscode.commands.executeCommand('logiclens.bookmarkAnswer', answer);

    editor.selection = new vscode.Selection(0, 0, 2, 5);
    notes.push('');
    await vscode.commands.executeCommand('logiclens.addBookmark');

    assert.deepStrictEqual(
      api.bookmarks.list().map((b) => [b.kind, b.note, b.title, b.ranges, b.markdown]),
      [
        [
          'step',
          'retry rule',
          '1 · Resolve the port',
          [{ start: 5, end: 8 }],
          'Returns the configured port, or 8080.\n\n`type coercion`',
        ],
        ['answer', '', 'why?', [{ start: 2, end: 2 }], 'Parses JSON.'],
        ['code', '', 'import { readFileSync } from "node:fs";', [{ start: 1, end: 3 }], ''],
      ],
    );
    // The step row now says it is bookmarked.
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      editor.document.uri,
    );
    assert.ok(lenses.some((l) => l.command?.title === '$(bookmark) Bookmarked'));
    // Only the walkthrough and the question were requests.
    assert.strictEqual(provider.requests.length, 2);
  });

  test('showing a bookmark highlights its lines and shows the saved text, even after Clear Cache', async () => {
    const editor = await openFile();
    await vscode.commands.executeCommand('logiclens.explainFile');
    notes.push('');
    await vscode.commands.executeCommand(
      'logiclens.bookmarkStep',
      editor.document.uri.toString(),
      0,
    );
    await vscode.commands.executeCommand('logiclens.clearCache');
    await vscode.commands.executeCommand('logiclens.closeExplanation');
    const [b] = api.bookmarks.list();
    assert.ok(b);
    const thread = await vscode.commands.executeCommand<vscode.CommentThread>(
      'logiclens.showBookmark',
      b.id,
    );
    assert.strictEqual(thread.label, 'Bookmarked explanation');
    assert.strictEqual(thread.range.start.line, 4);
    const body = thread.comments[0]?.body;
    assert.ok(
      (typeof body === 'string' ? body : body?.value)?.startsWith('Returns the configured port'),
    );
    assert.strictEqual(provider.requests.length, 1);

    // Explain again is the one bookmark action that sends.
    await vscode.commands.executeCommand('logiclens.explainBookmark', thread);
    assert.strictEqual(provider.requests.length, 2);
    assert.ok(provider.requests[1]?.messages[0]?.text.includes('Target: L5-L8'));
  });

  test('ranges move with edits; deleted lines mark the bookmark changed', async () => {
    const editor = await openFile();
    editor.selection = new vscode.Selection(5, 0, 5, 0);
    notes.push('');
    await vscode.commands.executeCommand('logiclens.addBookmark');
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), '// x\n'));
    assert.deepStrictEqual(api.bookmarks.list()[0]?.ranges, [{ start: 7, end: 7 }]);
    await editor.edit((e) => e.delete(new vscode.Range(6, 0, 7, 0)));
    assert.strictEqual(api.bookmarks.list()[0]?.changed, true);
  });

  test('excluded files cannot be bookmarked, and possible secrets are stored as hashes', async () => {
    const env = await openFile('NAME=value\n', '.env');
    notes.push('');
    await vscode.commands.executeCommand('logiclens.addBookmark');
    assert.strictEqual(api.bookmarks.list().length, 0);
    await vscode.window.showTextDocument(env.document);

    const key = ['AKIA', 'Q7RT2MZX4LNB8VHC'].join('');
    const editor = await openFile(`const a = 1;\nconst id = '${key}';\n`);
    editor.selection = new vscode.Selection(0, 0, 1, 5);
    notes.push('');
    await vscode.commands.executeCommand('logiclens.addBookmark');
    const [b] = api.bookmarks.list();
    assert.ok(b);
    assert.ok(!JSON.stringify(b).includes(key));
    assert.ok(b.lines[0]?.[1]?.startsWith('sha256:'));
  });

  test('Clear All Bookmarks asks first, then removes them', async () => {
    const editor = await openFile();
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    notes.push('');
    await vscode.commands.executeCommand('logiclens.addBookmark');
    const prompter = new FakePrompter();
    let asked = 0;
    prompter.confirm = async () => {
      asked++;
      return true;
    };
    api.setPrompter(prompter);
    await vscode.commands.executeCommand('logiclens.clearAllBookmarks');
    assert.strictEqual(asked, 1);
    assert.strictEqual(api.bookmarks.list().length, 0);
  });
});
