import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  FakePrompter,
  SAMPLE_FILE,
  SAMPLE_RESPONSE,
  type ExplainResult,
  type TestApi,
} from './fakes';

let api: TestApi;
let tmp: string;
let log: string;

const config = () => vscode.workspace.getConfiguration('logiclens');

/** A stand-in `claude` that records how it was run and replays a stream-json response. */
function writeStub(lines: string[], exitCode = 0): string {
  const out = path.join(tmp, 'out.jsonl');
  fs.writeFileSync(out, lines.map((l) => `${l}\n`).join(''));
  const stub = path.join(tmp, 'claude');
  fs.writeFileSync(
    stub,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "2.1.312 (Claude Code)"; exit 0; fi',
      `{ pwd; echo "files:$(ls -A)"; env | cut -d= -f1 | sort | tr '\\n' ' '; echo; for a in "$@"; do printf '[%s]' "$a"; done; echo; cat; } > "${log}"`,
      `cat "${out}"`,
      `exit ${exitCode}`,
    ].join('\n'),
  );
  fs.chmodSync(stub, 0o755);
  return stub;
}

const delta = (text: string) =>
  JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  });

async function explain(): Promise<ExplainResult> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'typescript',
    content: SAMPLE_FILE,
  });
  await vscode.window.showTextDocument(doc);
  return vscode.commands.executeCommand<ExplainResult>('logiclens.explainFile');
}

suite('Claude Code provider', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext);
    api = (await ext.activate()) as TestApi;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logiclens-cli-'));
    log = path.join(tmp, 'run.log');
  });

  setup(async () => {
    api.resetProviders();
    api.setPrompter(new FakePrompter());
    api.setTrusted(undefined);
    await api.globalState.update('providerChosen', true);
    await config().update('provider', 'claude-code', vscode.ConfigurationTarget.Global);
  });

  teardown(async () => {
    for (const key of ['provider', 'cli.claudePath']) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('runs the CLI headless in an empty directory with tools off and code on stdin', async () => {
    const lines = SAMPLE_RESPONSE.map(delta);
    lines.push(
      JSON.stringify({
        type: 'result',
        is_error: false,
        usage: { input_tokens: 900, output_tokens: 120 },
      }),
    );
    await config().update('cli.claudePath', writeStub(lines), vscode.ConfigurationTarget.Global);
    process.env.LOGICLENS_TEST_SECRET = 'must-not-pass';
    const result = await explain();
    delete process.env.LOGICLENS_TEST_SECRET;
    assert.strictEqual(result.kind, 'done');

    const [cwd, listing, env, args, ...stdin] = fs.readFileSync(log, 'utf8').split('\n');
    assert.ok(cwd?.includes(`${path.sep}cli${path.sep}run-`), `cwd ${cwd}`);
    assert.ok(!fs.existsSync(cwd ?? ''), 'work directory was not removed');
    assert.strictEqual(listing, 'files:', 'work directory was not empty');
    assert.ok(!env?.includes('LOGICLENS_TEST_SECRET'), 'environment was not minimal');
    assert.ok(!env?.includes('CLAUDE_CODE_SESSION_ID'), 'a parent session leaked in');
    assert.strictEqual(
      args,
      '[-p][--output-format][stream-json][--verbose][--include-partial-messages][--no-session-persistence][--tools][][--strict-mcp-config][--setting-sources][]',
    );
    assert.ok(stdin.join('\n').includes('return Number.isFinite(value) ? value : 8080;'));
  });

  test('a sign-in failure fails the request with an auth message', async () => {
    await config().update(
      'cli.claudePath',
      writeStub(
        [
          JSON.stringify({
            type: 'result',
            is_error: true,
            result: 'Not logged in · Please run /login',
          }),
        ],
        1,
      ),
      vscode.ConfigurationTarget.Global,
    );
    const result = await explain();
    assert.strictEqual(result.kind, 'failed');
  });

  test('a missing binary is reported as not installed, without sending', async () => {
    await config().update(
      'cli.claudePath',
      path.join(tmp, 'nope', 'claude'),
      vscode.ConfigurationTarget.Global,
    );
    const result = await explain();
    assert.strictEqual(result.kind, 'refused');
    assert.strictEqual(result.reason, 'provider-unavailable');
  });
});
