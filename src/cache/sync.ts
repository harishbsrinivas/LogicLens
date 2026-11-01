// Keeps the cache in step with the session (arch §7): saves a document's walkthrough and
// threads a second after they settle, and restores them when the document opens. Only `file`
// documents are cached; untitled ones have no stable identity.
import * as vscode from 'vscode';
import type { QuestionStore } from '../state/questions';
import { SessionStore } from '../state/session';
import type { WalkthroughView } from '../state/types';
import type { Logger } from '../util/log';
import { buildEntry, restoreEntry } from './restore';
import type { CacheKey, CacheStore } from './store';

const SAVE_DEBOUNCE_MS = 1000;

export interface CacheSyncDeps {
  store: CacheStore;
  session: SessionStore;
  questions: QuestionStore;
  log: Logger;
  enabled(): boolean;
  keyOf(uri: string, view: WalkthroughView | null): CacheKey;
}

export class CacheSync implements vscode.Disposable {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pending = new Set<Promise<unknown>>();
  /** Thread id → document key, so a deleted thread still saves its document. */
  private readonly threadKeys = new Map<string, string>();
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly deps: CacheSyncDeps) {
    this.subscriptions = [
      deps.session.onDidChange((key) => this.schedule(key)),
      deps.questions.onDidChange((id) => {
        const key = deps.questions.get(id)?.key ?? this.threadKeys.get(id);
        if (key) {
          this.threadKeys.set(id, key);
          this.schedule(key);
        }
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => this.track(this.restore(doc))),
    ];
    for (const doc of vscode.workspace.textDocuments) {
      this.track(this.restore(doc));
    }
  }

  /** Writes every scheduled save now; tests and deactivation wait on it. */
  async flush(): Promise<void> {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(key);
      this.track(this.save(key));
    }
    await Promise.all([...this.pending]);
  }

  /** Drops a scheduled save, as a window reload would. */
  cancel(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  /** Restores a document from the cache unless it already has a walkthrough or threads. */
  async restore(doc: vscode.TextDocument): Promise<boolean> {
    const { session, questions, store } = this.deps;
    const key = SessionStore.key(doc.uri);
    if (
      doc.uri.scheme !== 'file' ||
      !this.deps.enabled() ||
      session.get(key) ||
      questions.inDocument(key).length > 0
    ) {
      return false;
    }
    const entry = await store.latest(key);
    // The document may have been explained or closed while the file was read.
    if (!entry || session.get(key) || doc.isClosed) {
      return false;
    }
    const restored = restoreEntry(entry, doc.getText().split(/\r?\n/));
    if (restored.view) {
      session.set(key, {
        view: restored.view,
        raw: restored.raw,
        focus: null,
        opened: null,
        showAll: false,
      });
    }
    for (const t of restored.threads) {
      const thread = questions.create(key, t.range);
      questions.update(thread.id, (q) => {
        q.turns = t.turns;
        q.changed = t.changed;
      });
    }
    this.deps.log.info(
      `cache: restored ${restored.view ? `${restored.view.steps.length} steps` : 'no walkthrough'} and ${restored.threads.length} threads`,
    );
    return true;
  }

  private schedule(key: string): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.track(this.save(key));
      }, SAVE_DEBOUNCE_MS),
    );
  }

  private async save(key: string): Promise<void> {
    const { session, questions, store } = this.deps;
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    // A closed document keeps its cache entry; only open documents are saved.
    if (!doc || doc.uri.scheme !== 'file' || !this.deps.enabled()) {
      return;
    }
    const entry = session.get(key);
    if (entry?.cancel) {
      return; // still streaming; saved when it settles
    }
    const threads = questions.inDocument(key);
    if (!entry && threads.length === 0) {
      // Closed explanation and no threads: nothing should come back on reopen.
      await store.forget(key);
      return;
    }
    await store.save(
      buildEntry({
        key: this.deps.keyOf(key, entry?.view ?? null),
        lines: doc.getText().split(/\r?\n/),
        view: entry?.view ?? null,
        raw: entry?.raw ?? '',
        threads,
        now: Date.now(),
      }),
    );
  }

  private track(op: Promise<unknown>): void {
    const tracked = op.catch((err: unknown) => {
      this.deps.log.warn(`cache: ${err instanceof Error ? err.message : String(err)}`);
    });
    this.pending.add(tracked);
    void tracked.finally(() => this.pending.delete(tracked));
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}
