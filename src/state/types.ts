// Walkthrough state types (arch §7). Plain data, so it can be serialized to the cache (S8).
// No vscode imports.

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
  /** Its code was edited or could not be found again (S8, spec §10). */
  changed?: boolean;
}

export interface WalkthroughView {
  id: string;
  /** Selection or symbol lines explained, or null for the whole file (spec §3). */
  target: LineRange | null;
  /** Depth, audience, jargon, and language used (spec §4); plain strings so state stays pure. */
  style: { depth: string; audience: string; jargon: string; language: string };
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
  /** When the walkthrough was generated (ms since epoch). */
  createdAt?: number;
  /** Loaded from the cache rather than generated in this session (S8). */
  restored?: boolean;
  /** Token counts, when the provider reports them (spec §6 cost transparency). */
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** Continue can ask for the rest of a walkthrough that ended early with steps (spec §4). */
export function canContinue(view: WalkthroughView): boolean {
  return (
    (view.status === 'truncated' || view.status === 'failed') &&
    view.fallbackMarkdown === null &&
    view.steps.length > 0
  );
}
