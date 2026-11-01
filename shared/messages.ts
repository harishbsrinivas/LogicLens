// Types shared by the extension host and the webview (arch §6). No Node or vscode imports.

/** S0 placeholder command text; removed with `logiclens.hello` later in S1. */
export const HELLO_MESSAGE = 'Hello from LogicLens';

/** Inclusive, 1-based line range. */
export interface LineRange {
  start: number;
  end: number;
}

export type WalkthroughStatus = 'streaming' | 'done' | 'stopped' | 'failed' | 'truncated';

export interface StepView {
  /** 0-based position in the walkthrough; shown as index + 1. */
  index: number;
  title: string;
  ranges: LineRange[];
  text: string;
  concepts: string[];
  /** False when no range could be tied to the target (spec §4). */
  anchored: boolean;
}

export interface WalkthroughView {
  id: string;
  fileName: string;
  providerLabel: string;
  model: string;
  status: WalkthroughStatus;
  overview: string;
  steps: StepView[];
  summary: string;
  watch: string;
  /** Set when the response is shown as plain Markdown instead of steps (spec §10). */
  fallbackMarkdown: string | null;
  /** Short user-facing notice, for example why the fallback is shown. */
  notice: string | null;
  error: string | null;
  durationMs: number | null;
  /** Line numbers withheld by the secret scan. Never the text (ADR-0020). */
  withheld: number[];
  /** The document changed after this walkthrough was made (S2; per-step tracking in S8). */
  stale: boolean;
}

export type PanelState =
  | { kind: 'noEditor' }
  | { kind: 'empty'; fileName: string; termsAccepted: boolean }
  | { kind: 'excluded'; fileName: string }
  | { kind: 'walkthrough'; walkthrough: WalkthroughView; focus: number | null };

interface Session {
  sessionId: string;
}

export type HostToWebviewMessage = Session &
  (
    | { type: 'state'; state: PanelState }
    | { type: 'overviewDelta'; wid: string; text: string }
    | { type: 'stepStart'; wid: string; step: StepView }
    | { type: 'stepDelta'; wid: string; index: number; text: string }
    | { type: 'stepConcepts'; wid: string; index: number; concepts: string[] }
    | { type: 'summaryDelta'; wid: string; text: string }
    | { type: 'watchDelta'; wid: string; text: string }
    | { type: 'focus'; wid: string; index: number | null }
  );

export type WebviewToHostMessage = Session &
  (
    | { type: 'ready' }
    | { type: 'explain' }
    | { type: 'continue' }
    | { type: 'stop' }
    | { type: 'focusStep'; index: number }
    | { type: 'revealLine'; line: number }
    | { type: 'viewTerms' }
    | { type: 'openLink'; href: string }
  );

export const DELTA_TYPES = [
  'overviewDelta',
  'stepDelta',
  'summaryDelta',
  'watchDelta',
] as const satisfies readonly HostToWebviewMessage['type'][];
