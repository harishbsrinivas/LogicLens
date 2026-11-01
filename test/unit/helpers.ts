import type { KeyValueStore, NoticeChoice, Prompter, TermsChoice } from '../../src/guard/prompter';
import type {
  CancelToken,
  Provider,
  ProviderRequest,
  ProviderState,
  StreamChunk,
} from '../../src/providers/types';
import type { Logger } from '../../src/util/log';

/**
 * Joins parts so secret-shaped fixtures never appear whole in the repository (the secret
 * scanner in CI would flag them).
 */
export const fake = (...parts: string[]): string => parts.join('');

export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }
  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.data.delete(key);
    } else {
      this.data.set(key, value);
    }
  }
}

export class FakePrompter implements Prompter {
  termsAnswer: TermsChoice = 'agree';
  noticeAnswer: NoticeChoice = 'continue';
  confirmAnswer = true;
  readonly calls: string[] = [];

  async terms(): Promise<TermsChoice> {
    this.calls.push('terms');
    return this.termsAnswer;
  }
  async openTerms(): Promise<void> {
    this.calls.push('openTerms');
  }
  async dataNotice(): Promise<NoticeChoice> {
    this.calls.push('notice');
    return this.noticeAnswer;
  }
  async openUrl(url: string): Promise<void> {
    this.calls.push(`openUrl ${url}`);
  }
  async confirm(message: string): Promise<boolean> {
    this.calls.push(`confirm ${message}`);
    return this.confirmAnswer;
  }
}

export class FakeProvider implements Provider {
  readonly id = 'fake';
  readonly label = 'Fake Provider';
  readonly kind = 'vscode-lm' as const;
  readonly termsUrl = 'https://example.com/terms';
  readonly dataLeavesMachine = true;
  state: ProviderState = { kind: 'ready', models: [{ id: 'm1', label: 'Model One' }] };
  chunks = ['Hello ', 'world'];
  readonly requests: ProviderRequest[] = [];
  readonly tokens: CancelToken[] = [];

  async detect(): Promise<ProviderState> {
    return this.state;
  }

  async *stream(request: ProviderRequest, token: CancelToken): AsyncIterable<StreamChunk> {
    this.requests.push(request);
    this.tokens.push(token);
    for (const text of this.chunks) {
      yield { type: 'text', text };
    }
    yield { type: 'done' };
  }
}

export class MemoryLogger implements Logger {
  readonly lines: string[] = [];
  info(m: string): void {
    this.lines.push(m);
  }
  warn(m: string): void {
    this.lines.push(m);
  }
  error(m: string): void {
    this.lines.push(m);
  }
  debugContent(label: string, text: string): void {
    this.lines.push(`${label}: ${text}`);
  }
}

export function token(cancelled = false): CancelToken & { cancel(): void } {
  const listeners: (() => void)[] = [];
  const t = {
    isCancellationRequested: cancelled,
    onCancellationRequested(l: () => void) {
      listeners.push(l);
      return { dispose() {} };
    },
    cancel() {
      t.isCancellationRequested = true;
      listeners.forEach((l) => l());
    },
  };
  return t;
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
}
