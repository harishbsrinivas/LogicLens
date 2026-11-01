import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  claudeArgs,
  createClaudeCodeProvider,
  parseClaudeLine,
  renderPrompt,
} from '../../src/providers/cli/claudeCode';
import {
  CliError,
  minimalEnv,
  runCli,
  type ChildLike,
  type SpawnFn,
} from '../../src/providers/cli/spawn';
import { collect, token } from './helpers';

/** A child process double: tests drive its stdout, stderr, and exit. */
class FakeChild extends EventEmitter implements ChildLike {
  readonly pid = 4242;
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  stdinText = '';
  stdinEnded = false;
  readonly signals: string[] = [];
  readonly stdin = {
    write: (d: string) => (this.stdinText += d),
    end: () => (this.stdinEnded = true),
    on: () => undefined,
  };
  kill(signal?: NodeJS.Signals): boolean {
    this.signals.push(signal ?? 'SIGTERM');
    return true;
  }
  out(text: string): void {
    this.stdout.emit('data', Buffer.from(text));
  }
  exit(code: number): void {
    this.emit('close', code);
  }
}

function spawner(script: (child: FakeChild, args: readonly string[]) => void) {
  const calls: {
    binary: string;
    args: readonly string[];
    options: Parameters<SpawnFn>[2];
    child: FakeChild;
  }[] = [];
  const spawn: SpawnFn = (binary, args, options) => {
    const child = new FakeChild();
    calls.push({ binary, args, options, child });
    setTimeout(() => script(child, args), 0);
    return child;
  };
  return { spawn, calls };
}

const killGroup = (child: ChildLike, signal: NodeJS.Signals) => {
  child.kill(signal);
  // A killed process closes.
  setTimeout(() => (child as FakeChild).exit(143), 0);
};

const base = {
  binary: 'cli',
  args: ['-p'],
  stdin: 'PROMPT',
  cwd: '/tmp/x',
  env: {},
  timeoutMs: 1000,
};

describe('runCli', () => {
  it('spawns without a shell, detached, writes the prompt to stdin, and yields lines', async () => {
    const { spawn, calls } = spawner((c) => {
      c.out('one\ntw');
      c.out('o\nthree');
      c.exit(0);
    });
    const lines = await collect(runCli({ ...base, token: token(), spawn, killGroup }));
    expect(lines).toEqual(['one', 'two', 'three']);
    expect(calls[0]?.options).toMatchObject({ shell: false, detached: true, cwd: '/tmp/x' });
    expect(calls[0]?.args).toEqual(['-p']);
    expect(calls[0]?.child.stdinText).toBe('PROMPT');
    expect(calls[0]?.child.stdinEnded).toBe(true);
  });

  it('kills the process group on cancel and reports cancelled', async () => {
    const t = token();
    const { spawn, calls } = spawner((c) => c.out('partial\n'));
    const run = runCli({ ...base, token: t, spawn, killGroup });
    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const line of run) {
          seen.push(line);
          t.cancel();
        }
      })(),
    ).rejects.toMatchObject({ kind: 'cancelled' });
    expect(seen).toEqual(['partial']);
    expect(calls[0]?.child.signals).toEqual(['SIGTERM']);
  });

  it('times out and kills', async () => {
    const { spawn, calls } = spawner(() => undefined);
    await expect(
      collect(runCli({ ...base, timeoutMs: 20, token: token(), spawn, killGroup })),
    ).rejects.toMatchObject({
      kind: 'timeout',
    });
    expect(calls[0]?.child.signals).toEqual(['SIGTERM']);
  });

  it('reports a missing binary as not-found', async () => {
    const { spawn } = spawner((c) => {
      const err = Object.assign(new Error('spawn cli ENOENT'), { code: 'ENOENT' });
      c.emit('error', err);
    });
    await expect(
      collect(runCli({ ...base, token: token(), spawn, killGroup })),
    ).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('reports a non-zero exit with capped stderr', async () => {
    const { spawn } = spawner((c) => {
      c.stderr.emit('data', Buffer.from('x'.repeat(70 * 1024)));
      c.exit(2);
    });
    const err = await collect(runCli({ ...base, token: token(), spawn, killGroup })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).exitCode).toBe(2);
    expect((err as CliError).stderr.length).toBe(64 * 1024);
  });

  it('stops at the output cap', async () => {
    const { spawn } = spawner((c) => c.out('y'.repeat(1024 * 1024 + 1)));
    await expect(
      collect(runCli({ ...base, token: token(), spawn, killGroup })),
    ).rejects.toMatchObject({
      kind: 'output-cap',
    });
  });
});

describe('minimalEnv', () => {
  it('keeps only what a CLI needs to find its sign-in, proxy, and locale', () => {
    expect(
      minimalEnv({
        PATH: '/bin',
        HOME: '/h',
        ANTHROPIC_API_KEY: 'k',
        HTTPS_PROXY: 'p',
        GITHUB_TOKEN: 't',
        AWS_SECRET_ACCESS_KEY: 's',
        CLAUDE_CODE_SESSION_ID: 'parent',
        CLAUDE_CODE_USE_VERTEX: '1',
      }),
    ).toEqual({
      PATH: '/bin',
      HOME: '/h',
      ANTHROPIC_API_KEY: 'k',
      HTTPS_PROXY: 'p',
      CLAUDE_CODE_USE_VERTEX: '1',
    });
  });
});

describe('Claude Code stream', () => {
  const delta = (text: string) =>
    JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
    });
  const result = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    usage: { input_tokens: 12, output_tokens: 3 },
  });

  it('uses the verified flags: print mode, stream-json, no tools, no MCP, no settings', () => {
    expect(claudeArgs()).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--no-session-persistence',
      '--tools',
      '',
      '--strict-mcp-config',
      '--setting-sources',
      '',
    ]);
    expect(claudeArgs('default')).not.toContain('--model');
    expect(claudeArgs('sonnet').slice(-2)).toEqual(['--model', 'sonnet']);
  });

  it('parses text deltas, usage, and errors; ignores the rest', () => {
    expect(parseClaudeLine(delta('Hi'))).toEqual({ type: 'text', text: 'Hi' });
    expect(parseClaudeLine(result)).toEqual({
      type: 'usage',
      usage: { inputTokens: 12, outputTokens: 3 },
    });
    expect(
      parseClaudeLine(JSON.stringify({ type: 'assistant', error: 'authentication_failed' })),
    ).toMatchObject({
      type: 'error',
      category: 'auth',
    });
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: 'result',
          is_error: true,
          result: 'Not logged in · Please run /login',
        }),
      ),
    ).toMatchObject({ category: 'auth' });
    expect(
      parseClaudeLine(
        JSON.stringify({ type: 'result', is_error: true, result: 'API Error: 429 rate_limit' }),
      ),
    ).toMatchObject({
      category: 'rate-limit',
    });
    expect(
      parseClaudeLine(JSON.stringify({ type: 'system', subtype: 'init', tools: [] })),
    ).toBeUndefined();
    expect(parseClaudeLine('not json')).toBeUndefined();
  });

  it('lays out a conversation for print mode', () => {
    expect(renderPrompt({ system: 'SYS', messages: [{ role: 'user', text: 'Q' }] })).toBe(
      'SYS\n\nQ',
    );
    const multi = renderPrompt({
      system: 'SYS',
      messages: [
        { role: 'user', text: 'Q1' },
        { role: 'assistant', text: 'A1' },
        { role: 'user', text: 'Q2' },
      ],
    });
    expect(multi).toContain(
      '<user>\nQ1\n</user>\n\n<assistant>\nA1\n</assistant>\n\n<user>\nQ2\n</user>',
    );
  });

  function provider(script: (c: FakeChild, args: readonly string[]) => void) {
    const { spawn, calls } = spawner(script);
    const disposed: string[] = [];
    const p = createClaudeCodeProvider({
      binary: () => 'claude',
      timeoutMs: () => 1000,
      workDir: async () => ({
        path: '/iso/run-1',
        dispose: async () => void disposed.push('/iso/run-1'),
      }),
      env: () => ({ PATH: '/bin' }),
      spawn,
      killGroup,
    });
    return { p, calls, disposed };
  }

  it('streams text and usage from an isolated directory, and removes it', async () => {
    const { p, calls, disposed } = provider((c) => {
      c.out(`${delta('Hello ')}\n${delta('world')}\n${result}\n`);
      c.exit(0);
    });
    const chunks = await collect(
      p.stream({ system: 'S', messages: [{ role: 'user', text: 'code' }], model: 'opus' }, token()),
    );
    expect(chunks).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
      { type: 'done', usage: { inputTokens: 12, outputTokens: 3 } },
    ]);
    expect(calls[0]?.options.cwd).toBe('/iso/run-1');
    expect(calls[0]?.args).toContain('--tools');
    expect(calls[0]?.args.slice(-2)).toEqual(['--model', 'opus']);
    expect(calls[0]?.args.join(' ')).not.toContain('code');
    expect(calls[0]?.child.stdinText).toBe('S\n\ncode');
    expect(disposed).toEqual(['/iso/run-1']);
  });

  it('maps a sign-in failure to auth, and detection then reports Needs sign-in', async () => {
    const { p } = provider((c, args) => {
      if (args[0] === '--version') {
        c.out('2.1.312 (Claude Code)\n');
        c.exit(0);
        return;
      }
      c.out(`${JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in' })}\n`);
      c.exit(1);
    });
    expect((await p.detect()).kind).toBe('ready');
    await expect(
      collect(p.stream({ system: 'S', messages: [{ role: 'user', text: 'x' }] }, token())),
    ).rejects.toMatchObject({
      category: 'auth',
    });
    expect((await p.detect()).kind).toBe('needs-sign-in');
  });

  it('detects a missing binary as not installed', async () => {
    const { p } = provider((c) =>
      c.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    );
    expect(await p.detect()).toMatchObject({ kind: 'not-installed' });
  });
});
