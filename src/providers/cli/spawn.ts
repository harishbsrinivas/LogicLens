// Shared CLI runner (arch §4, ADR-0005, SECURITY.md §5): argument array, no shell, isolated
// working directory, minimal environment, prompt on stdin, line-by-line stdout, capped stderr
// and output, timeout, and process-group kill on cancel. Linux only until S13 (ADR-0026).
import { spawn as nodeSpawn } from 'node:child_process';
import type { CancelToken } from '../types';

export const STDERR_CAP_BYTES = 64 * 1024;
export const OUTPUT_CAP_BYTES = 1024 * 1024;
/** After SIGTERM, wait this long before SIGKILL. */
export const KILL_GRACE_MS = 2000;

export type CliErrorKind = 'not-found' | 'timeout' | 'cancelled' | 'output-cap' | 'exit';

export class CliError extends Error {
  constructor(
    readonly kind: CliErrorKind,
    message: string,
    readonly stderr = '',
    readonly exitCode: number | null = null,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

/** The subset of `ChildProcess` the runner uses, so tests can pass a fake. */
export interface ChildLike {
  readonly pid?: number;
  readonly stdin: {
    write(data: string): unknown;
    end(): unknown;
    on(e: 'error', l: () => void): unknown;
  } | null;
  readonly stdout: { on(e: 'data', l: (chunk: Buffer | string) => void): unknown } | null;
  readonly stderr: { on(e: 'data', l: (chunk: Buffer | string) => void): unknown } | null;
  on(event: 'error', listener: (err: NodeJS.ErrnoException) => void): unknown;
  on(event: 'close', listener: (code: number | null) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnFn = (
  binary: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; shell: false; detached: boolean },
) => ChildLike;

export interface RunOptions {
  binary: string;
  args: readonly string[];
  /** Written to stdin, then stdin is closed. User code goes only here, never in `args`. */
  stdin: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  token: CancelToken;
  spawn?: SpawnFn;
  /** Kills the process group; injected in tests. */
  killGroup?: (child: ChildLike, signal: NodeJS.Signals) => void;
}

/** Variables a CLI may need to find its own sign-in, proxy, and locale. Nothing else is passed. */
const ENV_NAMES = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  // Claude Code sign-in and backend choice. Not the CLAUDE_CODE_ prefix as a whole: a parent
  // Claude Code session sets session and messaging variables the child must not inherit.
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
];
const ENV_PREFIXES = ['ANTHROPIC_'];

export function minimalEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(source)) {
    if (
      value !== undefined &&
      (ENV_NAMES.includes(name) || ENV_PREFIXES.some((p) => name.startsWith(p)))
    ) {
      env[name] = value;
    }
  }
  return env;
}

const defaultSpawn: SpawnFn = (binary, args, options) => nodeSpawn(binary, [...args], options);

const defaultKillGroup = (child: ChildLike, signal: NodeJS.Signals): void => {
  try {
    // Detached children lead their own process group; a negative pid signals all of it.
    if (child.pid) {
      process.kill(-child.pid, signal);
      return;
    }
  } catch {
    // The group may already be gone; fall back to the child alone.
  }
  child.kill(signal);
};

/** Runs the CLI and yields complete stdout lines. Throws `CliError` on failure. */
export async function* runCli(options: RunOptions): AsyncIterable<string> {
  const spawnFn = options.spawn ?? defaultSpawn;
  const killGroup = options.killGroup ?? defaultKillGroup;
  if (options.token.isCancellationRequested) {
    throw new CliError('cancelled', 'Stopped.');
  }

  const lines: string[] = [];
  let partial = '';
  let stderr = '';
  let outputBytes = 0;
  let failure: CliError | undefined;
  let closed = false;
  let exitCode: number | null = null;
  let wake: (() => void) | undefined;
  const notify = (): void => {
    wake?.();
    wake = undefined;
  };

  const child = spawnFn(options.binary, options.args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    detached: true,
  });

  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = (err: CliError): void => {
    if (failure || closed) {
      return;
    }
    failure = err;
    killGroup(child, 'SIGTERM');
    killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), KILL_GRACE_MS);
    notify();
  };

  const timer = setTimeout(
    () =>
      stop(
        new CliError(
          'timeout',
          `The CLI did not finish within ${Math.round(options.timeoutMs / 1000)} seconds.`,
        ),
      ),
    options.timeoutMs,
  );
  const cancel = options.token.onCancellationRequested(() =>
    stop(new CliError('cancelled', 'Stopped.')),
  );

  child.on('error', (err) => {
    failure ??=
      err.code === 'ENOENT'
        ? new CliError('not-found', `${options.binary} was not found.`)
        : new CliError('exit', `${options.binary} could not be started: ${err.message}`);
    closed = true;
    notify();
  });
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    outputBytes += Buffer.byteLength(text);
    if (outputBytes > OUTPUT_CAP_BYTES) {
      stop(new CliError('output-cap', 'The CLI produced more output than LogicLens accepts.'));
      return;
    }
    partial += text;
    const parts = partial.split('\n');
    partial = parts.pop() ?? '';
    lines.push(...parts);
    notify();
  });
  child.stderr?.on('data', (chunk) => {
    if (stderr.length < STDERR_CAP_BYTES) {
      stderr = (stderr + chunk.toString()).slice(0, STDERR_CAP_BYTES);
    }
  });
  child.on('close', (code) => {
    closed = true;
    clearTimeout(killTimer);
    exitCode = code;
    if (partial) {
      lines.push(partial);
      partial = '';
    }
    notify();
  });

  // EPIPE when the child exits before reading stdin surfaces through 'close' instead.
  child.stdin?.on('error', () => undefined);
  child.stdin?.write(options.stdin);
  child.stdin?.end();

  try {
    for (;;) {
      const line = lines.shift();
      if (line !== undefined) {
        if (!failure) {
          yield line;
        }
        continue;
      }
      if (failure) {
        throw failure;
      }
      if (closed) {
        if (exitCode !== 0) {
          throw new CliError(
            'exit',
            `${options.binary} exited with code ${String(exitCode)}.`,
            stderr,
            exitCode,
          );
        }
        return;
      }
      await new Promise<void>((resolve) => (wake = resolve));
    }
  } finally {
    clearTimeout(timer);
    cancel.dispose();
    if (!closed) {
      // The consumer stopped early (an error while parsing): do not leave the CLI running.
      stop(new CliError('cancelled', 'Stopped.'));
    }
  }
}
