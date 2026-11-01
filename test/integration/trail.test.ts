import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  FakePrompter,
  FakeProvider,
  type ExplainResult,
  type PickerEntry,
  type TestApi,
} from './fakes';

let api: TestApi;
let provider: FakeProvider;
let tmp: string;
let files: Record<'a' | 'b' | 'c', vscode.Uri>;
let registrations: vscode.Disposable[];
let answers: (string | undefined)[];
let picks: PickerEntry[][];

const A = [
  'import { verifyUser } from "./b";',
  'export function handle(token) {',
  '  const user = verifyUser(token);',
  '  return multi(user) + nothing;',
  '}',
].join('\n');
const B = ['// b', 'export function verifyUser(token) {', '  return decode(token);', '}'].join(
  '\n',
);
const C = [
  'export function decode(t) {',
  '  return t;',
  '}',
  'export function multi(x) { return x; }',
].join('\n');

async function open(uri: vscode.Uri, line = 0, character = 0): Promise<vscode.TextEditor> {
  const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
  editor.selection = new vscode.Selection(line, character, line, character);
  return editor;
}

const active = () => path.basename(vscode.window.activeTextEditor?.document.uri.fsPath ?? '');

async function crumbs(uri: vscode.Uri): Promise<string[]> {
  const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
    'vscode.executeCodeLensProvider',
    uri,
  );
  return lenses
    .filter((l) =>
      ['logiclens.trailGo', 'logiclens.trailPick', 'logiclens.explainSymbol'].includes(
        l.command?.command ?? '',
      ),
    )
    .map((l) => `${l.range.start.line}:${l.command?.title ?? ''}`);
}

suite('Follow across files', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-f-'));
    files = {
      a: vscode.Uri.file(path.join(tmp, 'a.txt')),
      b: vscode.Uri.file(path.join(tmp, 'b.txt')),
      c: vscode.Uri.file(path.join(tmp, 'c.txt')),
    };
    fs.writeFileSync(files.a.fsPath, A);
    fs.writeFileSync(files.b.fsPath, B);
    fs.writeFileSync(files.c.fsPath, C);
    const at = (uri: vscode.Uri, line: number, ch = 16) =>
      new vscode.Location(uri, new vscode.Position(line, ch));
    registrations = [
      vscode.languages.registerDefinitionProvider('plaintext', {
        provideDefinition(doc, pos) {
          const word = doc.getText(doc.getWordRangeAtPosition(pos));
          switch (word) {
            case 'verifyUser':
              return at(files.b, 1);
            case 'decode':
              return at(files.c, 0);
            case 'multi':
              return [at(files.c, 3), at(files.b, 1)];
            default:
              return [];
          }
        },
      }),
      vscode.languages.registerDocumentSymbolProvider('plaintext', {
        provideDocumentSymbols: (doc) =>
          doc.uri.fsPath === files.b.fsPath
            ? [
                new vscode.DocumentSymbol(
                  'verifyUser',
                  '',
                  vscode.SymbolKind.Function,
                  new vscode.Range(1, 0, 3, 1),
                  new vscode.Range(1, 16, 1, 26),
                ),
              ]
            : [],
      }),
    ];
  });

  suiteTeardown(() => registrations.forEach((r) => r.dispose()));

  setup(async () => {
    provider = new FakeProvider();
    provider.chunks = [
      '@@overview\nHandles a request.\n@@step 1 | L2-L5 | Handle\nCalls verifyUser.\n@@end\n',
    ];
    api.setProvider(provider);
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
    await api.globalState.update('providerChosen', true);
    await api.follow.clear();
    answers = [];
    picks = [];
    api.setPick(async (entries) => {
      picks.push(entries);
      return answers.shift();
    });
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('follows a definition into another file and shows the trail above line 1', async () => {
    await open(files.a, 2, 16);
    assert.strictEqual(
      await vscode.commands.executeCommand('logiclens.followDefinition'),
      'followed',
    );
    assert.strictEqual(active(), 'b.txt');
    assert.deepStrictEqual(
      api.follow.trail.all().map((e) => [path.basename(vscode.Uri.parse(e.uri).fsPath), e.symbol]),
      [
        ['a.txt', 'verifyUser'],
        ['b.txt', 'verifyUser'],
      ],
    );
    // Crumbs, then Explain for the symbol followed to (b.txt has no walkthrough).
    assert.deepStrictEqual(await crumbs(files.b), [
      '0:a.txt › verifyUser',
      '0:● b.txt › verifyUser',
      '1:Explain verifyUser',
    ]);
    assert.deepStrictEqual(await crumbs(files.a), []);
  });

  test('offers a choice when there are several definitions, and does nothing when there are none', async () => {
    await open(files.a, 3, 10);
    answers.push('1');
    assert.strictEqual(
      await vscode.commands.executeCommand('logiclens.followDefinition'),
      'followed',
    );
    // VS Code returns the locations sorted by file.
    assert.deepStrictEqual(
      picks[0]?.map((p) => p.label),
      ['b.txt:2', 'c.txt:4'],
    );
    assert.strictEqual(active(), 'c.txt');

    await api.follow.clear();
    await open(files.a, 3, 26);
    assert.strictEqual(await vscode.commands.executeCommand('logiclens.followDefinition'), 'none');
    assert.strictEqual(api.follow.trail.size, 0);
  });

  test('back returns to the focused step; a new follow drops forward entries', async () => {
    const a = await open(files.a);
    assert.strictEqual(
      (await vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile')).kind,
      'done',
    );
    await vscode.commands.executeCommand('logiclens.nextStep');
    a.selection = new vscode.Selection(2, 16, 2, 16);
    await vscode.commands.executeCommand('logiclens.followDefinition');
    const b = vscode.window.activeTextEditor;
    assert.ok(b);
    b.selection = new vscode.Selection(2, 10, 2, 10);
    await vscode.commands.executeCommand('logiclens.followDefinition');
    assert.strictEqual(active(), 'c.txt');

    await vscode.commands.executeCommand('logiclens.trailBack');
    await vscode.commands.executeCommand('logiclens.trailBack');
    assert.strictEqual(active(), 'a.txt');
    assert.strictEqual(api.decorations.appliedTo(files.a)?.number, 1);
    await vscode.commands.executeCommand('logiclens.trailForward');
    assert.strictEqual(active(), 'b.txt');

    // From b, follow something else: c's entry goes.
    const again = vscode.window.activeTextEditor;
    assert.ok(again);
    again.selection = new vscode.Selection(1, 16, 1, 16);
    await vscode.commands.executeCommand('logiclens.followDefinition');
    assert.deepStrictEqual(
      api.follow.trail.all().map((e) => path.basename(vscode.Uri.parse(e.uri).fsPath)),
      ['a.txt', 'b.txt', 'b.txt'],
    );
    // Only the walkthrough request; following and the trail never send.
    assert.strictEqual(provider.requests.length, 1);
  });

  test('Follow… on a step lists the identifiers in it that have a definition', async () => {
    await open(files.a);
    await vscode.commands.executeCommand('logiclens.explainFile');
    const thread = api.threads.stepThread(files.a, 0);
    assert.ok(thread);
    // multi, then its second definition.
    answers.push('1', '1');
    assert.strictEqual(
      await vscode.commands.executeCommand('logiclens.followFromStep', thread),
      'followed',
    );
    assert.deepStrictEqual(
      picks[0]?.map((p) => p.label),
      ['verifyUser', 'multi'],
    );
    assert.strictEqual(active(), 'c.txt');
  });
});
