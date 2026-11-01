// Orchestrates a line question (arch §5.8, spec §5): window, gate, prompt, stream, state.
import * as vscode from 'vscode';
import type { RequestGate } from '../guard/gate';
import { pathInfo } from '../guard/settings';
import { ProviderError } from '../providers/types';
import { questionMessages, questionSystem, type PriorTurn } from '../prompts/question';
import type { QuestionStore, Turn } from '../state/questions';
import { newId } from '../state/questions';
import { SessionStore } from '../state/session';
import type { LineRange } from '../state/types';
import type { Logger } from '../util/log';
import { buildWindowContext, rangeText } from './context';
import {
  HISTORY_BUDGET_CHARS,
  MAX_IN_FLIGHT,
  questionWindow,
  validateQuestion,
  type AskResult,
} from './questionWindow';

export type { AskResult } from './questionWindow';
export { validateQuestion } from './questionWindow';

export interface QuestionDeps {
  gate: RequestGate;
  store: QuestionStore;
  session: SessionStore;
  log: Logger;
  maxLines(): number;
  /** The innermost document symbol containing `range`, if the language has a symbol provider. */
  enclosingSymbol(document: vscode.TextDocument, range: LineRange): Promise<LineRange | undefined>;
}

export class QuestionService {
  private readonly cancels = new Map<string, vscode.CancellationTokenSource>();
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly deps: QuestionDeps) {}

  /** Adds a turn to the thread and answers it. Refusals remove the turn again. */
  async ask(document: vscode.TextDocument, threadId: string, question: string): Promise<AskResult> {
    const invalid = validateQuestion(question);
    if (invalid) {
      return invalid;
    }
    const turn: Turn = {
      id: newId('t'),
      question: question.trim(),
      answer: '',
      status: 'queued',
      providerLabel: '',
      model: '',
      error: null,
    };
    this.deps.store.update(threadId, (t) => t.turns.push(turn));
    return this.answer(document, threadId, turn.id);
  }

  async regenerate(
    document: vscode.TextDocument,
    threadId: string,
    turnId: string,
  ): Promise<AskResult | undefined> {
    const turn = this.deps.store.get(threadId)?.turns.find((t) => t.id === turnId);
    if (!turn || this.cancels.has(turnId)) {
      return undefined;
    }
    this.deps.store.update(threadId, () => {
      turn.answer = '';
      turn.error = null;
      turn.status = 'queued';
    });
    return this.answer(document, threadId, turnId);
  }

  isBusy(threadId: string): boolean {
    const thread = this.deps.store.get(threadId);
    return Boolean(thread?.turns.some((t) => this.cancels.has(t.id)));
  }

  stop(threadId: string): void {
    for (const turn of this.deps.store.get(threadId)?.turns ?? []) {
      this.cancels.get(turn.id)?.cancel();
    }
  }

  stopAll(): void {
    for (const cancel of this.cancels.values()) {
      cancel.cancel();
    }
  }

  private async answer(
    document: vscode.TextDocument,
    threadId: string,
    turnId: string,
  ): Promise<AskResult> {
    const { store } = this.deps;
    const cancel = new vscode.CancellationTokenSource();
    this.cancels.set(turnId, cancel);
    const setTurn = (change: (turn: Turn) => void): void =>
      updateTurn(store, threadId, turnId, change);
    let acquired = false;
    try {
      acquired = await this.acquire(cancel.token);
      if (!acquired) {
        setTurn((t) => (t.status = 'stopped'));
        return { kind: 'stopped', threadId, turnId };
      }
      const result = await this.send(document, threadId, turnId, cancel);
      if (result.kind === 'refused') {
        store.update(threadId, (t) => (t.turns = t.turns.filter((x) => x.id !== turnId)));
        if (store.get(threadId)?.turns.length === 0) {
          store.delete(threadId);
        }
      }
      return result;
    } finally {
      if (acquired) {
        this.release();
      }
      this.cancels.delete(turnId);
      cancel.dispose();
      store.update(threadId, () => undefined);
    }
  }

  private async send(
    document: vscode.TextDocument,
    threadId: string,
    turnId: string,
    cancel: vscode.CancellationTokenSource,
  ): Promise<AskResult> {
    const { store, gate, log } = this.deps;
    const thread = store.get(threadId);
    const index = thread?.turns.findIndex((t) => t.id === turnId) ?? -1;
    const turn = thread?.turns[index];
    if (!thread || !turn) {
      return { kind: 'refused', reason: 'cancelled', message: 'The thread was deleted.' };
    }
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const target = clampRange(thread.range, lines.length);
    const window = questionWindow(
      lines.length,
      text.length,
      this.deps.maxLines(),
      target,
      await this.deps.enclosingSymbol(document, target),
    );
    const windowLines = lines.slice(window.start - 1, window.end);
    const info = pathInfo(document.uri);
    const history: PriorTurn[] = thread.turns
      .slice(0, index)
      .filter((t) => t.status === 'done' && t.answer.trim())
      .map((t) => ({ question: t.question, answer: t.answer }));
    const related = this.relatedStep(document, target);

    const outcome = await gate.send(
      {
        target: {
          ...info,
          fileName: displayName(document),
          languageId: document.languageId,
          lines: windowLines,
          byteLength: Buffer.byteLength(windowLines.join('\n'), 'utf8'),
          firstLine: window.start,
        },
        build: (prepared) => ({
          system: questionSystem(),
          messages: questionMessages(
            buildWindowContext({
              path: info.relPath ?? displayName(document),
              languageId: document.languageId,
              lines: prepared.lines,
              withheld: prepared.withheld,
              firstLine: window.start,
              lineCount: lines.length,
              target,
            }),
            related,
            history,
            turn.question,
            HISTORY_BUDGET_CHARS,
          ).messages,
        }),
      },
      cancel.token,
    );
    if (outcome.kind === 'refused') {
      return outcome;
    }

    const setTurn = (change: (turn: Turn) => void): void =>
      updateTurn(store, threadId, turnId, change);
    setTurn((t) => {
      t.status = 'streaming';
      t.providerLabel = outcome.providerLabel;
      t.model = outcome.model;
    });
    const started = Date.now();
    try {
      for await (const chunk of outcome.stream) {
        if (chunk.type === 'text') {
          store.stream(threadId, turnId, chunk.text);
        }
      }
      const stopped = cancel.token.isCancellationRequested;
      setTurn((t) => (t.status = stopped ? 'stopped' : 'done'));
      log.info(`question: ${stopped ? 'stopped' : 'done'} after ${Date.now() - started} ms`);
      return { kind: stopped ? 'stopped' : 'done', threadId, turnId };
    } catch (err) {
      if (
        cancel.token.isCancellationRequested ||
        (err instanceof ProviderError && err.category === 'cancelled')
      ) {
        setTurn((t) => (t.status = 'stopped'));
        return { kind: 'stopped', threadId, turnId };
      }
      const message =
        err instanceof ProviderError ? err.message : 'The answer failed unexpectedly.';
      log.error(`question: failed (${err instanceof ProviderError ? err.category : 'unexpected'})`);
      setTurn((t) => {
        t.status = 'failed';
        t.error = message;
      });
      return { kind: 'failed', threadId, turnId, message };
    } finally {
      log.debugContent(
        'answer',
        store.get(threadId)?.turns.find((t) => t.id === turnId)?.answer ?? '',
      );
    }
  }

  /** The walkthrough overview and the step containing the target, as context (spec §5). */
  private relatedStep(document: vscode.TextDocument, target: LineRange): string {
    const view = this.deps.session.get(SessionStore.key(document.uri))?.view;
    if (!view || view.fallbackMarkdown !== null || view.stale) {
      return '';
    }
    const step = view.steps.find(
      (s) => s.anchored && s.ranges.some((r) => r.start <= target.start && target.start <= r.end),
    );
    const parts = [];
    if (view.overview.trim()) {
      parts.push(`Walkthrough overview:\n${view.overview.trim()}`);
    }
    if (step) {
      parts.push(
        `Walkthrough step ${step.index + 1} (${step.ranges.map(rangeText).join(', ')}): ${step.title}\n${step.text.trim()}`,
      );
    }
    return parts.join('\n\n');
  }

  private acquire(token: vscode.CancellationToken): Promise<boolean> {
    if (this.running < MAX_IN_FLIGHT) {
      this.running++;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const go = (): void => {
        sub.dispose();
        this.running++;
        resolve(true);
      };
      const sub = token.onCancellationRequested(() => {
        const i = this.waiting.indexOf(go);
        if (i !== -1) {
          this.waiting.splice(i, 1);
        }
        sub.dispose();
        resolve(false);
      });
      this.waiting.push(go);
    });
  }

  private release(): void {
    this.running--;
    this.waiting.shift()?.();
  }
}

function updateTurn(
  store: QuestionStore,
  threadId: string,
  turnId: string,
  change: (turn: Turn) => void,
): void {
  store.update(threadId, (t) => {
    const turn = t.turns.find((x) => x.id === turnId);
    if (turn) {
      change(turn);
    }
  });
}

function clampRange(range: LineRange, lineCount: number): LineRange {
  const start = Math.min(Math.max(1, range.start), lineCount);
  return { start, end: Math.min(Math.max(start, range.end), lineCount) };
}

function displayName(document: vscode.TextDocument): string {
  const path = document.uri.path;
  return path.slice(path.lastIndexOf('/') + 1) || document.fileName;
}
