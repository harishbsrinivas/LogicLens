// In-memory session state (arch §7): the latest walkthrough per document and its focus.
// Nothing persisted before S8.
import * as vscode from 'vscode';
import { applyEdits, type LineEdit } from './rangeTracker';
import type { WalkthroughView } from './types';

export interface SessionEntry {
  view: WalkthroughView;
  /** Set while the request is streaming. */
  cancel?: vscode.CancellationTokenSource;
  /** The model's raw response so far, sent back on Continue. Never shown or logged. */
  raw: string;
  /** Focused step index (highlighted; moves with the cursor in follow mode), or null. */
  focus: number | null;
  /** Step whose thread is expanded; changes only on an explicit focus, not on cursor moves. */
  opened: number | null;
  /** Expand every step thread instead of only the focused one. */
  showAll: boolean;
}

export class SessionStore implements vscode.Disposable {
  private readonly entries = new Map<string, SessionEntry>();
  private readonly changed = new vscode.EventEmitter<string>();
  private readonly delta = new vscode.EventEmitter<{ key: string; wid: string }>();

  /** Fires with the document key on structural changes: start, new step, status, focus. */
  readonly onDidChange = this.changed.event;
  /** Fires when streamed text is appended; renderers may batch these. */
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

  /** Applies a structural change to the current walkthrough if it is still `wid`. */
  update(key: string, wid: string, change: (entry: SessionEntry) => void): void {
    const entry = this.entries.get(key);
    if (entry?.view.id === wid) {
      change(entry);
      this.changed.fire(key);
    }
  }

  /** Applies a text-only change (streamed deltas) if the walkthrough is still `wid`. */
  stream(key: string, wid: string, change: (entry: SessionEntry) => void): void {
    const entry = this.entries.get(key);
    if (entry?.view.id === wid) {
      change(entry);
      this.delta.fire({ key, wid });
    }
  }

  /** `open` also expands that step's thread (explicit focus); follow mode passes false. */
  setFocus(key: string, focus: number | null, open: boolean): void {
    const entry = this.entries.get(key);
    const opened = open ? focus : entry?.opened;
    if (entry && (entry.focus !== focus || entry.opened !== opened)) {
      entry.focus = focus;
      entry.opened = opened ?? null;
      this.changed.fire(key);
    }
  }

  setShowAll(key: string, showAll: boolean): void {
    const entry = this.entries.get(key);
    if (entry && entry.showAll !== showAll) {
      entry.showAll = showAll;
      this.changed.fire(key);
    }
  }

  /**
   * Moves the walkthrough's ranges through an edit (arch §7): steps whose lines were edited or
   * deleted are marked changed, and the walkthrough is marked stale.
   */
  applyEdits(key: string, edits: readonly LineEdit[]): void {
    const entry = this.entries.get(key);
    if (!entry || edits.length === 0) {
      return;
    }
    const { view } = entry;
    for (const step of view.steps) {
      let touched = false;
      step.ranges = step.ranges.map((r) => {
        const moved = applyEdits(r, edits);
        touched ||= moved.touched || moved.deleted;
        return moved.range;
      });
      step.changed ||= touched;
    }
    if (view.target) {
      view.target = applyEdits(view.target, edits).range;
    }
    view.withheld = view.withheld.flatMap((line) => {
      const moved = applyEdits({ start: line, end: line }, edits);
      return moved.deleted ? [] : [moved.range.start];
    });
    view.stale = true;
    this.changed.fire(key);
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
