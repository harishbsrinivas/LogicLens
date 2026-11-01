import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
  FakePrompter,
  FakeProvider,
  SAMPLE_FILE,
  SAMPLE_RESPONSE,
  type ExplainResult,
  type TestApi,
} from './fakes';

let api: TestApi;
let provider: FakeProvider;

async function explainSample(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'typescript',
    content: SAMPLE_FILE,
  });
  await vscode.window.showTextDocument(doc);
  const result = await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
  assert.strictEqual(result.kind, 'done');
  return doc;
}

function steps(doc: vscode.TextDocument) {
  return api.threads.stepSnapshots(doc.uri);
}

async function lenses(doc: vscode.TextDocument): Promise<string[]> {
  const found = await vscode.commands.executeCommand<vscode.CodeLens[]>(
    'vscode.executeCodeLensProvider',
    doc.uri,
  );
  return found
    .filter((l) => l.command?.command === 'logiclens.focusStep')
    .map((l) => `${l.range.start.line}:${l.command?.title ?? ''}`);
}

suite('Step walkthrough', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
  });

  setup(async () => {
    provider = new FakeProvider();
    api.setProvider(provider);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace
      .getConfiguration('logiclens')
      .update('focusDimming', undefined, vscode.ConfigurationTarget.Global);
  });

  test('puts each step in a collapsed thread just above its first line', async () => {
    const doc = await explainSample();
    const s = steps(doc);
    assert.deepStrictEqual(
      s.map((t) => [t.index, t.line, t.label, t.commentLabel, t.expanded]),
      [
        // Step 1 starts at line 5, so its thread hangs off line 4 (0-based 3).
        [0, 3, '1 · Resolve the port', 'L5–8', false],
        // Step 2 starts at line 1; a thread cannot sit above it, so it goes under line 1.
        [1, 0, '2 · Load the config', 'L1–3', false],
      ],
    );
    assert.ok(s[0]?.body.startsWith('Returns the configured port, or 8080.\n\n[`type coercion`]('));
    assert.ok(s[0]?.body.includes('command:logiclens.askConcept?'));
    assert.strictEqual(s[0]?.contextValue, 'step');
  });

  test('shows a title CodeLens with Previous and Next above each step', async () => {
    const doc = await explainSample();
    // VS Code returns lenses sorted by position.
    assert.deepStrictEqual(await lenses(doc), [
      '0:2 · Load the config  L1–3',
      '0:‹ Previous',
      '4:1 · Resolve the port  L5–8',
      '4:Next ›',
    ]);
  });

  test('Next and Previous focus steps: expand, highlight, dim, number, move the cursor', async () => {
    const doc = await explainSample();
    await vscode.commands.executeCommand('logiclens.nextStep');
    assert.deepStrictEqual(
      steps(doc).map((t) => t.expanded),
      [true, false],
    );
    const applied = api.decorations.appliedTo(doc.uri);
    assert.deepStrictEqual(applied?.focus, [{ start: 5, end: 8 }]);
    assert.strictEqual(applied?.number, 1);
    assert.strictEqual(applied?.dimmed, 2);
    assert.strictEqual(vscode.window.activeTextEditor?.selection.active.line, 4);
    assert.ok((await lenses(doc)).includes('4:$(arrow-right) 1 · Resolve the port  L5–8'));

    await vscode.commands.executeCommand('logiclens.nextStep');
    assert.deepStrictEqual(
      steps(doc).map((t) => t.expanded),
      [false, true],
    );
    assert.deepStrictEqual(api.decorations.appliedTo(doc.uri)?.focus, [{ start: 1, end: 3 }]);

    // At the last step, Next stays put.
    await vscode.commands.executeCommand('logiclens.nextStep');
    assert.strictEqual(api.decorations.appliedTo(doc.uri)?.number, 2);

    await vscode.commands.executeCommand('logiclens.previousStep');
    assert.strictEqual(api.decorations.appliedTo(doc.uri)?.number, 1);
  });

  test('Clear Step Highlight removes the decorations and keeps the walkthrough', async () => {
    const doc = await explainSample();
    await vscode.commands.executeCommand('logiclens.nextStep');
    await vscode.commands.executeCommand('logiclens.clearFocus');
    const applied = api.decorations.appliedTo(doc.uri);
    assert.deepStrictEqual(applied?.focus, []);
    assert.strictEqual(applied?.number, null);
    assert.strictEqual(applied?.dimmed, 0);
    assert.strictEqual(steps(doc).length, 2);
  });

  test('dimming follows logiclens.focusDimming', async () => {
    await vscode.workspace
      .getConfiguration('logiclens')
      .update('focusDimming', false, vscode.ConfigurationTarget.Global);
    const doc = await explainSample();
    await vscode.commands.executeCommand('logiclens.nextStep');
    assert.strictEqual(api.decorations.appliedTo(doc.uri)?.dimmed, 0);
  });

  test('the step title CodeLens command focuses that step', async () => {
    const doc = await explainSample();
    await vscode.commands.executeCommand('logiclens.focusStep', doc.uri.toString(), 1);
    assert.strictEqual(api.decorations.appliedTo(doc.uri)?.number, 2);
    // Arguments are checked.
    await vscode.commands.executeCommand('logiclens.focusStep', doc.uri.toString(), 9);
    await vscode.commands.executeCommand('logiclens.focusStep', 'file:///etc/passwd', 0);
    assert.strictEqual(api.decorations.appliedTo(doc.uri)?.number, 2);
  });

  test('Show All Steps expands every step thread', async () => {
    const doc = await explainSample();
    await vscode.commands.executeCommand('logiclens.showAllSteps');
    assert.deepStrictEqual(
      steps(doc).map((t) => t.expanded),
      [true, true],
    );
    await vscode.commands.executeCommand('logiclens.showAllSteps');
    assert.deepStrictEqual(
      steps(doc).map((t) => t.expanded),
      [false, false],
    );
  });

  test('editing the document marks the walkthrough stale', async () => {
    const doc = await explainSample();
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), '// note\n'));
    assert.match(api.threads.snapshot(doc.uri)?.label ?? '', /file changed since/);
  });

  test('lists steps that cannot be tied to lines in the overview', async () => {
    provider.chunks = [
      '@@overview\nO\n@@step 1 | L1-L3 | Good\nA\n@@step 2 | L1-L3 | Also good\nB\n',
      '@@step 3 | L500-L520 | Lost\nC\n@@end\n',
    ];
    const doc = await explainSample();
    assert.deepStrictEqual(
      steps(doc).map((t) => t.index),
      [0, 1],
    );
    assert.match(
      api.threads.snapshot(doc.uri)?.body ?? '',
      /\*\*3 · Lost\*\* \(not linked to lines\)\n\nC/,
    );
  });

  test('falls back to Markdown when most steps cannot be tied to lines', async () => {
    // 2 of 3 steps unanchored is more than half.
    provider.chunks = [
      '@@overview\nO\n@@step 1 | L1 | Ok\nA\n@@step 2 | L900 | Lost\nB\n',
      '@@step 3 | L950 | Gone\nC\n@@end\n',
    ];
    const doc = await explainSample();
    const body = api.threads.snapshot(doc.uri)?.body ?? '';
    assert.match(body, /most steps could not be tied to lines/);
    assert.match(body, /#### 2\. Lost\n\nB/);
    assert.deepStrictEqual(steps(doc), []);
  });

  test('a truncated response offers Continue, which appends the remaining steps', async () => {
    provider.queued.push(
      ['@@overview\nO\n@@step 1 | L5-L8 | First\nA\n@@step 2 | L1-L3 | Sec'],
      ['@@step 2 | L1-L3 | Second\nB\n@@summary\n- S\n@@watch\n- none\n@@end\n'],
    );
    const doc = await vscode.workspace.openTextDocument({
      language: 'typescript',
      content: SAMPLE_FILE,
    });
    await vscode.window.showTextDocument(doc);
    const first = await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
    assert.strictEqual(first.kind, 'truncated');
    const overview = api.threads.snapshot(doc.uri);
    assert.strictEqual(overview?.contextValue, 'continuable');
    assert.match(overview?.label ?? '', /incomplete/);
    // The half-written step 2 has no text yet, so it is dropped.
    assert.deepStrictEqual(
      steps(doc).map((t) => t.label),
      ['1 · First'],
    );

    const second = await vscode.commands.executeCommand<ExplainResult>('logiclens.continue');
    assert.strictEqual(second.kind, 'done');
    assert.deepStrictEqual(
      steps(doc).map((t) => t.label),
      ['1 · First', '2 · Second'],
    );
    const request = provider.requests[1];
    assert.strictEqual(request?.messages.length, 3);
    assert.strictEqual(request?.messages[1]?.role, 'assistant');
    assert.ok(request?.messages[1]?.text.startsWith('@@overview'));
    assert.match(request?.messages[2]?.text ?? '', /Continue the walkthrough/);
    assert.strictEqual(api.threads.snapshot(doc.uri)?.contextValue, 'finished');
  });

  test('the sample response is well formed', () => {
    assert.ok(SAMPLE_RESPONSE.join('').endsWith('@@end\n'));
  });
});
