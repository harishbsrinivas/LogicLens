// In-memory question threads (arch §7, spec §5). Persisted with the cache in S8.
import * as vscode from 'vscode';
import { newId } from '../util/id';
import type { LineRange } from './types';

export type TurnStatus = 'queued' | 'streaming' | 'done' | 'stopped' | 'failed';

export interface Turn {
  id: string;
  question: string;
  /** Model output; rendered through safeMarkdown only. */
  answer: string;
  status: TurnStatus;
  providerLabel: string;
  model: string;
  error: string | null;
}

export interface QuestionThread {
  id: string;
  /** Document key (`SessionStore.key`). */
  key: string;
  /** Lines the question is about (1-based, inclusive); moves with edits above it. */
  range: LineRange;
  turns: Turn[];
  /** The anchored lines were deleted (spec §5). */
  changed: boolean;
}

export class QuestionStore implements vscode.Disposable {
  private readonly threads = new Map<string, QuestionThread>();
  private readonly changed = new vscode.EventEmitter<string>();
  private readonly delta = new vscode.EventEmitter<string>();

  /** Fires with the thread id on structural changes: turns, status, range, removal. */
  readonly onDidChange = this.changed.event;
  /** Fires with the thread id when streamed answer text is appended. */
  readonly onDelta = this.delta.event;

  create(key: string, range: LineRange): QuestionThread {
    const thread: QuestionThread = { id: newId('q'), key, range, turns: [], changed: false };
    this.threads.set(thread.id, thread);
    this.changed.fire(thread.id);
    return thread;
  }

  get(id: string): QuestionThread | undefined {
    return this.threads.get(id);
  }

  inDocument(key: string): QuestionThread[] {
    return [...this.threads.values()].filter((t) => t.key === key);
  }

  all(): QuestionThread[] {
    return [...this.threads.values()];
  }

  update(id: string, change: (thread: QuestionThread) => void): void {
    const thread = this.threads.get(id);
    if (thread) {
      change(thread);
      this.changed.fire(id);
    }
  }

  stream(id: string, turnId: string, text: string): void {
    const turn = this.threads.get(id)?.turns.find((t) => t.id === turnId);
    if (turn) {
      turn.answer += text;
      this.delta.fire(id);
    }
  }

  delete(id: string): void {
    if (this.threads.delete(id)) {
      this.changed.fire(id);
    }
  }

  deleteDocument(key: string): void {
    for (const t of this.inDocument(key)) {
      this.delete(t.id);
    }
  }

  dispose(): void {
    this.threads.clear();
    this.changed.dispose();
    this.delta.dispose();
  }
}
