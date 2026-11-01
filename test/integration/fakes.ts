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

export interface PanelStateLike {
  kind: string;
  walkthrough?: {
    status: string;
    fallbackMarkdown: string | null;
    providerLabel: string;
    model: string;
    withheld: number[];
    error: string | null;
  };
  termsAccepted?: boolean;
}

export interface TestApi {
  setProvider(provider: FakeProvider): void;
  setPrompter(prompter: FakePrompter): void;
  setTrusted(trusted: boolean | undefined): void;
  globalState: vscode.Memento;
  panel: { computeState(): Promise<PanelStateLike> };
}

export interface ExplainResult {
  kind: 'done' | 'stopped' | 'failed' | 'refused';
  reason?: string;
  lines?: number[];
}

export class FakeProvider {
  readonly id = 'fake';
  readonly label = 'Fake Provider';
  readonly kind = 'vscode-lm';
  readonly termsUrl = 'https://example.com/terms';
  readonly dataLeavesMachine = true;
  chunks = ['## Overview\n', 'This file ', 'adds numbers.'];
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
    for (const [i, text] of this.chunks.entries()) {
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
