// Test doubles for integration tests. Mirrors the shapes in src/; tests compile separately.
import type * as vscode from 'vscode';

export interface CancelToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface ProviderRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; text: string }[];
  model?: string;
}

export type StreamChunk = { type: 'text'; text: string } | { type: 'done' };

export interface ThreadSnapshot {
  line: number;
  label: string;
  contextValue: string;
  authors: string[];
  commentLabel: string;
  body: string;
  expanded: boolean;
}

export interface AppliedDecorations {
  focus: { start: number; end: number }[];
  dimmed: number;
  number: number | null;
  withheld: number[];
}

/** A small file and a matching protocol response, used by most tests. */
export const SAMPLE_FILE = [
  'import { readFileSync } from "node:fs";',
  'const raw = readFileSync("config.json", "utf8");',
  'const config = JSON.parse(raw);',
  '',
  'export function port(): number {',
  '  const value = Number(config.port);',
  '  return Number.isFinite(value) ? value : 8080;',
  '}',
  '',
].join('\n');

export const SAMPLE_RESPONSE = [
  '@@overview\nReads a config file and exposes the port.\n',
  '@@step 1 | L5-L8 | Resolve the port\nReturns the configured port, ',
  'or 8080.\n@@concepts type coercion\n',
  '@@step 2 | L1-L3 | Load the config\nReads and parses `config.json`.\n',
  '@@summary\n- Port comes from config.\n@@watch\n- Throws if the file is missing.\n@@end\n',
];

export interface TestApi {
  setProvider(provider: FakeProvider): void;
  setPrompter(prompter: FakePrompter): void;
  setTrusted(trusted: boolean | undefined): void;
  globalState: vscode.Memento;
  threads: {
    snapshot(uri: vscode.Uri): ThreadSnapshot | undefined;
    stepSnapshots(uri: vscode.Uri): (ThreadSnapshot & { index: number })[];
  };
  decorations: { appliedTo(uri: vscode.Uri): AppliedDecorations | undefined };
  setInput(input: (prompt: string, value: string) => Thenable<string | undefined>): void;
  questions: {
    snapshots(uri: vscode.Uri): QuestionSnapshot[];
    comments(threadId: string): readonly (vscode.Comment & { part?: string })[];
    pendingThreads(uri: vscode.Uri): vscode.CommentThread[];
  };
}

export interface QuestionSnapshot {
  id: string;
  line: number;
  label: string;
  contextValue: string;
  collapsed: boolean;
  comments: { author: string; body: string; contextValue: string }[];
}

export interface AskResult {
  kind: 'done' | 'stopped' | 'failed' | 'refused';
  reason?: string;
  threadId?: string;
}

export interface ExplainResult {
  kind: 'done' | 'stopped' | 'truncated' | 'failed' | 'refused';
  reason?: string;
  lines?: number[];
}

export class FakeProvider {
  readonly id = 'fake';
  readonly label = 'Fake Provider';
  readonly kind = 'vscode-lm';
  readonly termsUrl = 'https://example.com/terms';
  readonly dataLeavesMachine = true;
  chunks = SAMPLE_RESPONSE;
  /** Per-request chunk lists, used in order before falling back to `chunks`. */
  readonly queued: string[][] = [];
  /** When set, the stream waits after the first chunk until cancelled. */
  hold = false;
  detectCalls = 0;
  readonly requests: ProviderRequest[] = [];
  private firstChunk: (() => void) | undefined;
  readonly firstChunkSent = new Promise<void>((resolve) => (this.firstChunk = resolve));

  async detect() {
    this.detectCalls++;
    return { kind: 'ready' as const, models: [{ id: 'fake-model', label: 'Fake Model' }] };
  }

  async *stream(request: ProviderRequest, token: CancelToken): AsyncIterable<StreamChunk> {
    this.requests.push(request);
    const chunks = this.queued.shift() ?? this.chunks;
    for (const [i, text] of chunks.entries()) {
      yield { type: 'text', text };
      if (i === 0 && this.hold) {
        this.firstChunk?.();
        await new Promise<void>((resolve) => token.onCancellationRequested(resolve));
        const err = new Error('Stopped.') as Error & { category: string };
        err.category = 'cancelled';
        throw err;
      }
    }
    yield { type: 'done' };
  }
}

export class FakePrompter {
  terms: () => Promise<'agree' | 'view' | 'cancel'> = async () => 'agree';
  readonly calls: string[] = [];
  async openTerms() {
    this.calls.push('openTerms');
  }
  async dataNotice() {
    this.calls.push('notice');
    return 'continue' as const;
  }
  async openUrl() {}
  async confirm() {
    return true;
  }
}
