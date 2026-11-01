// In-memory session state (arch §7): the latest walkthrough per document. Nothing persisted in S1.
import * as vscode from 'vscode';
import type { WalkthroughView } from '../../shared/messages';

export interface SessionEntry {
  view: WalkthroughView;
  /** Set while the request is streaming. */
  cancel?: vscode.CancellationTokenSource;
}

export class SessionStore implements vscode.Disposable {
  private readonly entries = new Map<string, SessionEntry>();
  private readonly changed = new vscode.EventEmitter<string>();
  private readonly delta = new vscode.EventEmitter<{ key: string; wid: string; text: string }>();

  /** Fires with the document key when a walkthrough starts, finishes, or is replaced. */
  readonly onDidChange = this.changed.event;
  /** Fires for each streamed text chunk. */
  readonly onDelta = this.delta.event;

  static key(uri: vscode.Uri): string {
    return uri.toString();
  }

  get(key: string): SessionEntry | undefined {
    return this.entries.get(key);
  }

  isBusy(key: string): boolean {
    return Boolean(this.entries.get(key)?.cancel);
  }

  anyBusy(): boolean {
    return [...this.entries.values()].some((e) => e.cancel);
  }

  set(key: string, entry: SessionEntry): void {
    this.entries.get(key)?.cancel?.cancel();
    this.entries.set(key, entry);
    this.changed.fire(key);
  }

  /** Applies a change to the current walkthrough if it is still `wid`. */
  update(key: string, wid: string, change: (entry: SessionEntry) => void): void {
    const entry = this.entries.get(key);
    if (entry?.view.id === wid) {
      change(entry);
      this.changed.fire(key);
    }
  }

  appendMarkdown(key: string, wid: string, text: string): void {
    const entry = this.entries.get(key);
    if (entry?.view.id === wid) {
      entry.view.fallbackMarkdown = (entry.view.fallbackMarkdown ?? '') + text;
      this.delta.fire({ key, wid, text });
    }
  }

  stop(key: string): void {
    this.entries.get(key)?.cancel?.cancel();
  }

  stopAll(): void {
    for (const entry of this.entries.values()) {
      entry.cancel?.cancel();
    }
  }

  delete(key: string): void {
    this.entries.get(key)?.cancel?.cancel();
    if (this.entries.delete(key)) {
      this.changed.fire(key);
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.cancel?.cancel();
      entry.cancel?.dispose();
    }
    this.entries.clear();
    this.changed.dispose();
    this.delta.dispose();
  }
}
