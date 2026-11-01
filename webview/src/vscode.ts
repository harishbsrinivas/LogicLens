import type { WebviewToHostMessage } from '../../shared/messages';

type Payload = WebviewToHostMessage extends infer M
  ? M extends WebviewToHostMessage
    ? Omit<M, 'sessionId'>
    : never
  : never;

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api = acquireVsCodeApi();

/** Set by the host in the page; every message carries it so stale pages are ignored. */
export const sessionId = document.getElementById('root')?.dataset.session ?? '';

export function send(message: Payload): void {
  api.postMessage({ ...message, sessionId });
}
