import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  FakePrompter,
  FakeProvider,
  SAMPLE_FILE,
  SAMPLE_RESPONSE,
  type AskResult,
  type ExplainResult,
  type TestApi,
} from './fakes';

let api: TestApi;
let provider: FakeProvider;
let tmp: string;

async function openSample(): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'typescript',
    content: SAMPLE_FILE,
  });
  return vscode.window.showTextDocument(doc);
}

/** Opens a question thread at `line` (1-based) through the command, as the user would. */
async function openThread(editor: vscode.TextEditor, line: number): Promise<vscode.CommentThread> {
  const pos = new vscode.Position(line - 1, 0);
  editor.selection = new vscode.Selection(pos, pos);
  const thread = await vscode.commands.executeCommand<vscode.CommentThread>('logiclens.askAtLine');
  assert.ok(thread);
  return thread;
}

function submit(thread: vscode.CommentThread, text: string): Thenable<AskResult> {
  return vscode.commands.executeCommand<AskResult>('logiclens.submitQuestion', { thread, text });
}

function threads(doc: vscode.TextDocument) {
  return api.questions.snapshots(doc.uri);
}

suite('Ask at any line', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-q-'));
  });

  setup(() => {
    provider = new FakeProvider();
    provider.chunks = ['The port ', 'comes from L3.'];
    api.setProvider(provider);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
  });

  teardown(async () => {
    await vscode.commands.executeCommand('logiclens.clearAllThreads');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('answers a question inline under its line, with the target marked', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 6);
    const result = await submit(thread, 'Why Number()?');
    assert.strictEqual(result.kind, 'done');
    const [snap] = threads(editor.document);
    assert.ok(snap);
    assert.strictEqual(snap.line, 5);
    assert.deepStrictEqual(
      snap.comments.map((c) => [c.author, c.contextValue]),
      [
        ['You', 'question'],
        ['LogicLens · Fake Provider/Fake Model', 'answer'],
      ],
    );
    assert.strictEqual(snap.comments[0]?.body, 'Why Number()?');
    // The line reference became a link that moves the cursor.
    assert.ok(snap.comments[1]?.body.includes('[L3](command:logiclens.revealLine?'));
    const sent = provider.requests[0]?.messages.at(-1)?.text ?? '';
    assert.ok(sent.includes('<<<TARGET\n  6│   const value = Number(config.port);\nTARGET>>>'));
    assert.ok(sent.endsWith('Question: Why Number()?'));
  });

  test('follow-ups include the earlier turn as history', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 6);
    await submit(thread, 'first?');
    const result = await submit(thread, 'and then?');
    assert.strictEqual(result.kind, 'done');
    const messages = provider.requests[1]?.messages ?? [];
    assert.deepStrictEqual(
      messages.map((m) => m.role),
      ['user', 'assistant', 'user'],
    );
    assert.strictEqual(messages[1]?.text, 'The port comes from L3.');
    assert.strictEqual(messages[2]?.text, 'and then?');
    assert.strictEqual(threads(editor.document)[0]?.comments.length, 4);
  });

  test('Stop keeps the partial answer and marks it stopped', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 2);
    provider.hold = true;
    const pending = submit(thread, 'what?');
    await provider.firstChunkSent;
    assert.strictEqual(threads(editor.document)[0]?.contextValue, 'question-busy');
    await vscode.commands.executeCommand('logiclens.stopQuestion', thread);
    const result = await pending;
    assert.strictEqual(result.kind, 'stopped');
    const body = threads(editor.document)[0]?.comments[1]?.body ?? '';
    assert.ok(body.includes('The port'));
    assert.ok(body.includes('*Stopped.*'));
  });

  test('regenerates an answer in place and deletes a thread from its first question', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 2);
    const result = await submit(thread, 'what?');
    const id = result.threadId ?? '';
    provider.queued.push(['Second answer.']);
    const answer = api.questions.comments(id).find((c) => c.part === 'answer');
    await vscode.commands.executeCommand('logiclens.regenerateAnswer', answer);
    assert.strictEqual(provider.requests.length, 2);
    const snap = threads(editor.document)[0];
    assert.strictEqual(snap?.comments.length, 2);
    assert.strictEqual(snap?.comments[1]?.body, 'Second answer.');

    const question = api.questions.comments(id).find((c) => c.part === 'question');
    await vscode.commands.executeCommand('logiclens.deleteQuestionComment', question);
    assert.deepStrictEqual(threads(editor.document), []);
  });

  test('refuses empty and over-length questions without sending', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 2);
    assert.strictEqual((await submit(thread, '  ')).reason, 'empty');
    assert.strictEqual((await submit(thread, 'x'.repeat(2001))).reason, 'too-long');
    assert.strictEqual(provider.requests.length, 0);
    assert.deepStrictEqual(threads(editor.document), []);
  });

  test('refuses in an excluded file without sending', async () => {
    const file = path.join(tmp, '.env');
    fs.writeFileSync(file, 'NAME=value\n');
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    const editor = await vscode.window.showTextDocument(doc);
    const thread = await openThread(editor, 1);
    const result = await submit(thread, 'what is this?');
    assert.strictEqual(result.reason, 'excluded');
    assert.strictEqual(provider.requests.length, 0);
    assert.deepStrictEqual(threads(doc), []);
  });

  test('moves with lines inserted above and is marked when its line is deleted', async () => {
    const editor = await openSample();
    const thread = await openThread(editor, 6);
    await submit(thread, 'what?');
    await editor.edit((b) => b.insert(new vscode.Position(0, 0), 'a\nb\nc\n'));
    assert.strictEqual(threads(editor.document)[0]?.line, 8);
    await editor.edit((b) => b.delete(new vscode.Range(7, 0, 9, 0)));
    const snap = threads(editor.document)[0];
    assert.strictEqual(snap?.label, 'Code changed');
    assert.strictEqual(snap?.collapsed, true);
  });

  test('a concept tag asks with the question pre-filled at its step', async () => {
    const editor = await openSample();
    provider.chunks = SAMPLE_RESPONSE;
    const explained = await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
    assert.strictEqual(explained.kind, 'done');
    const prompts: string[] = [];
    api.setInput(async (_prompt, value) => {
      prompts.push(value);
      return value;
    });
    provider.chunks = ['Coercion turns a value into a number.'];
    const key = editor.document.uri.toString();
    const result = await vscode.commands.executeCommand<AskResult>(
      'logiclens.askConcept',
      key,
      0,
      0,
    );
    assert.strictEqual(result.kind, 'done');
    assert.deepStrictEqual(prompts, ['What is type coercion, and how is it used here?']);
    const snap = threads(editor.document)[0];
    // Step 1 covers L5-L8; the thread sits at its first line.
    assert.strictEqual(snap?.line, 4);
    const sent = provider.requests.at(-1)?.messages.at(-1)?.text ?? '';
    assert.ok(sent.includes('Target: L5-L8'));
    assert.ok(sent.includes('Walkthrough step 1 (L5-L8): Resolve the port'));
  });

  test('Clear Threads in File removes its threads', async () => {
    const editor = await openSample();
    await submit(await openThread(editor, 2), 'one?');
    await submit(await openThread(editor, 4), 'two?');
    assert.strictEqual(threads(editor.document).length, 2);
    await vscode.commands.executeCommand('logiclens.clearThreadsInFile');
    assert.deepStrictEqual(threads(editor.document), []);
  });
});
