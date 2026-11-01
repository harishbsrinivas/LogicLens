// `claude-code` adapter (arch §4, ADR-0005). Invocation verified in S0 (Claude Code 2.1.312,
// Linux): print mode, stream-json with partial messages, no session file, no tools, no MCP
// servers, no user or project settings. The prompt goes on stdin.
import {
  ProviderError,
  type CancelToken,
  type ChatMessage,
  type ModelInfo,
  type Provider,
  type ProviderErrorCategory,
  type ProviderRequest,
  type ProviderState,
  type StreamChunk,
  type Usage,
} from '../types';
import { CliError, runCli, type ChildLike, type SpawnFn } from './spawn';

export const CLAUDE_CODE_ID = 'claude-code';
export const DETECT_TIMEOUT_MS = 5000;
/** After an auth failure, detection reports "Needs sign-in" this long (the CLI has no status command). */
export const SIGN_IN_MEMORY_MS = 60_000;
/** Means "no --model flag": the CLI's own default (spec §6: no hardcoded default model). */
export const DEFAULT_MODEL = 'default';

export function claudeArgs(model?: string): string[] {
  const args = [
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
  ];
  if (model && model !== DEFAULT_MODEL) {
    args.push('--model', model);
  }
  return args;
}

/** Print mode takes one prompt, so the system prompt and turns are laid out as text. */
export function renderPrompt(request: Pick<ProviderRequest, 'system' | 'messages'>): string {
  const last = request.messages[request.messages.length - 1];
  if (request.messages.length === 1 && last) {
    return `${request.system}\n\n${last.text}`;
  }
  const turns = request.messages.map((m: ChatMessage) => `<${m.role}>\n${m.text}\n</${m.role}>`);
  return [
    request.system,
    'The conversation so far follows. Reply to the last user turn only, as the assistant, without the tags.',
    ...turns,
  ].join('\n\n');
}

export type ClaudeEvent =
  | { type: 'text'; text: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'error'; category: ProviderErrorCategory; message: string };

type ErrorKind = 'auth' | 'rate-limit' | 'quota' | 'unknown';

const MESSAGES: Record<ErrorKind, { category: ProviderErrorCategory; message: string }> = {
  auth: {
    category: 'auth',
    message:
      'Claude Code is not signed in. Run `claude` in a terminal and sign in, then try again.',
  },
  'rate-limit': {
    category: 'rate-limit',
    message: 'Claude Code hit a rate limit. Wait a moment and try again.',
  },
  quota: {
    category: 'quota',
    message:
      'Claude Code reports a usage limit for your plan. Try again later or choose another provider.',
  },
  unknown: { category: 'unknown', message: 'Claude Code reported an error.' },
};

function classify(text: string): ErrorKind {
  if (/authentication|not logged in|\/login|unauthori[sz]ed|invalid api key/i.test(text)) {
    return 'auth';
  }
  if (/rate.?limit|overloaded|429/i.test(text)) {
    return 'rate-limit';
  }
  if (/usage limit|quota|credit|billing/i.test(text)) {
    return 'quota';
  }
  return 'unknown';
}

/** Parses one stream-json line. Unknown or malformed lines are ignored. Pure. */
export function parseClaudeLine(line: string): ClaudeEvent | undefined {
  let data: unknown;
  try {
    data = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (record.type === 'stream_event') {
    const event = record.event as
      { type?: unknown; delta?: { type?: unknown; text?: unknown } } | undefined;
    if (
      event?.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      return { type: 'text', text: event.delta.text };
    }
    return undefined;
  }
  if (record.type === 'assistant' && typeof record.error === 'string') {
    return { type: 'error', ...MESSAGES[classify(record.error)] };
  }
  if (record.type === 'result') {
    if (record.is_error === true) {
      const text = typeof record.result === 'string' ? record.result : String(record.subtype ?? '');
      return { type: 'error', ...MESSAGES[classify(text)] };
    }
    const usage = record.usage as { input_tokens?: unknown; output_tokens?: unknown } | undefined;
    return {
      type: 'usage',
      usage: {
        inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined,
      },
    };
  }
  return undefined;
}

export interface WorkDir {
  path: string;
  dispose(): Promise<void>;
}

export interface ClaudeCodeDeps {
  /** `logiclens.cli.claudePath` (machine scope) or `claude` on PATH. */
  binary(): string;
  timeoutMs(): number;
  /** A fresh empty directory under the extension's global storage (ADR-0005). */
  workDir(): Promise<WorkDir>;
  env(): NodeJS.ProcessEnv;
  now?(): number;
  spawn?: SpawnFn;
  killGroup?: (child: ChildLike, signal: NodeJS.Signals) => void;
}

const MODELS: ModelInfo[] = [
  { id: DEFAULT_MODEL, label: 'Claude Code · default' },
  { id: 'sonnet', label: 'Claude Code · Sonnet' },
  { id: 'opus', label: 'Claude Code · Opus' },
  { id: 'haiku', label: 'Claude Code · Haiku' },
];

export function createClaudeCodeProvider(deps: ClaudeCodeDeps): Provider {
  let authFailedAt: number | undefined;
  const now = (): number => deps.now?.() ?? Date.now();

  async function* run(
    args: string[],
    stdin: string,
    timeoutMs: number,
    token: CancelToken,
  ): AsyncIterable<string> {
    const dir = await deps.workDir();
    try {
      yield* runCli({
        binary: deps.binary(),
        args,
        stdin,
        cwd: dir.path,
        env: deps.env(),
        timeoutMs,
        token,
        spawn: deps.spawn,
        killGroup: deps.killGroup,
      });
    } finally {
      await dir.dispose();
    }
  }

  return {
    id: CLAUDE_CODE_ID,
    label: 'Claude Code',
    kind: 'cli',
    termsUrl: 'https://www.anthropic.com/legal/consumer-terms',
    dataLeavesMachine: true,
    setup: {
      label: 'Install Claude Code',
      url: 'https://docs.anthropic.com/en/docs/claude-code/setup',
    },

    async detect(): Promise<ProviderState> {
      const never: CancelToken = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => undefined }),
      };
      try {
        let version = '';
        for await (const line of run(['--version'], '', DETECT_TIMEOUT_MS, never)) {
          version ||= line.trim();
        }
        if (authFailedAt !== undefined && now() - authFailedAt < SIGN_IN_MEMORY_MS) {
          return {
            kind: 'needs-sign-in',
            reason: 'Claude Code is not signed in. Run `claude` in a terminal and sign in.',
          };
        }
        return version
          ? { kind: 'ready', models: MODELS }
          : { kind: 'unavailable', reason: 'Claude Code did not report a version.' };
      } catch (err) {
        if (err instanceof CliError && err.kind === 'not-found') {
          return {
            kind: 'not-installed',
            reason: 'Claude Code (`claude`) was not found on PATH or at logiclens.cli.claudePath.',
          };
        }
        return {
          kind: 'unavailable',
          reason: `Claude Code could not be started: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },

    async *stream(request: ProviderRequest, token: CancelToken): AsyncIterable<StreamChunk> {
      let usage: Usage | undefined;
      try {
        for await (const line of run(
          claudeArgs(request.model),
          renderPrompt(request),
          deps.timeoutMs(),
          token,
        )) {
          const event = parseClaudeLine(line);
          if (event?.type === 'text') {
            yield { type: 'text', text: event.text };
          } else if (event?.type === 'usage') {
            usage = event.usage;
          } else if (event?.type === 'error') {
            if (event.category === 'auth') {
              authFailedAt = now();
            }
            throw new ProviderError(event.category, event.message);
          }
        }
      } catch (err) {
        throw mapError(err);
      }
      authFailedAt = undefined;
      yield { type: 'done', usage };
    },
  };
}

function mapError(err: unknown): ProviderError {
  if (err instanceof ProviderError) {
    return err;
  }
  if (err instanceof CliError) {
    switch (err.kind) {
      case 'cancelled':
        return new ProviderError('cancelled', 'Stopped.');
      case 'timeout':
        return new ProviderError(
          'timeout',
          `${err.message} Raise logiclens.cli.timeoutSeconds if it needs longer.`,
        );
      case 'not-found':
        return new ProviderError(
          'not-found',
          'Claude Code (`claude`) was not found. Install it or set logiclens.cli.claudePath.',
        );
      case 'output-cap':
        return new ProviderError('bad-response', err.message);
      default: {
        const kind = classify(err.stderr);
        return kind === 'unknown'
          ? new ProviderError('unknown', `Claude Code failed (exit code ${String(err.exitCode)}).`)
          : new ProviderError(MESSAGES[kind].category, MESSAGES[kind].message);
      }
    }
  }
  return new ProviderError('unknown', 'Claude Code failed unexpectedly.');
}
