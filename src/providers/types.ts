// Provider contract (arch §4). Adapters see strings only, never documents or ranges.

/** Minimal cancellation token so adapters and the gate can be unit tested without vscode. */
export interface CancelToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export type ProviderKind = 'vscode-lm' | 'cli' | 'http';

export type ProviderState =
  | { kind: 'ready'; models: ModelInfo[] }
  | { kind: 'needs-sign-in'; reason: string }
  | { kind: 'not-installed'; reason: string }
  | { kind: 'unavailable'; reason: string };

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProviderRequest {
  system: string;
  messages: ChatMessage[];
  model?: string;
  maxOutputTokens?: number;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export type StreamChunk = { type: 'text'; text: string } | { type: 'done'; usage?: Usage };

export type ProviderErrorCategory =
  | 'auth'
  | 'quota'
  | 'rate-limit'
  | 'timeout'
  | 'not-found'
  | 'cancelled'
  | 'bad-response'
  | 'unknown';

export class ProviderError extends Error {
  constructor(
    readonly category: ProviderErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface Provider {
  readonly id: string;
  readonly label: string;
  readonly kind: ProviderKind;
  readonly termsUrl: string;
  readonly dataLeavesMachine: boolean;
  /** Must not send user code. */
  detect(): Promise<ProviderState>;
  stream(request: ProviderRequest, token: CancelToken): AsyncIterable<StreamChunk>;
}
