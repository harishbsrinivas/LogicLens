// Bookmarks service (spec §14, ADR-0022): keeps bookmark ranges in step with edits and
// re-anchors them when a document opens. Never imports providers or the gate (arch §3); the
// only request a bookmark can lead to is Explain again, which goes through the explain command.
import * as vscode from 'vscode';
import { applyEdits, toLineEdits } from '../state/rangeTracker';
import { reanchor } from '../state/reanchor';
import type { BookmarkStore } from './store';

const SAVE_DEBOUNCE_MS = 1000;

export class BookmarkService implements vscode.Disposable {
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly store: BookmarkStore) {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((e) => this.track(e)),
      vscode.workspace.onDidOpenTextDocument((doc) => void this.reanchor(doc)),
    ];
  }

  /** Loads the store and re-anchors bookmarks in documents that are already open. */
  async start(): Promise<void> {
    await this.store.load();
    await Promise.all(vscode.workspace.textDocuments.map((d) => this.reanchor(d)));
  }

  /** Finds each bookmark's lines again by their saved text (spec §14). */
  async reanchor(doc: vscode.TextDocument): Promise<void> {
    await this.store.load();
    const marks = this.store.inDocument(doc.uri.toString());
    if (marks.length === 0) {
      return;
    }
    const lines = doc.getText().split(/\r?\n/);
    let dirty = false;
    for (const b of marks) {
      const ranges = b.ranges.map((r, i) => {
        const start = reanchor(lines, b.lines[i] ?? [], r.start);
        return start === undefined ? undefined : { start, end: start + (r.end - r.start) };
      });
      const lost = ranges.some((r) => r === undefined);
      const next = ranges.map((r, i) => r ?? b.ranges[i] ?? { start: 1, end: 1 });
      if (lost !== b.changed || JSON.stringify(next) !== JSON.stringify(b.ranges)) {
        b.changed = lost;
        b.ranges = next;
        dirty = true;
      }
    }
    if (dirty) {
      await this.store.persist();
    }
  }

  private track(e: vscode.TextDocumentChangeEvent): void {
    const marks = this.store.inDocument(e.document.uri.toString());
    if (marks.length === 0 || e.contentChanges.length === 0) {
      return;
    }
    const edits = toLineEdits(e.contentChanges);
    for (const b of marks) {
      b.ranges = b.ranges.map((r) => {
        const moved = applyEdits(r, edits);
        b.changed ||= moved.deleted;
        return moved.range;
      });
    }
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.store.persist(), SAVE_DEBOUNCE_MS);
  }

  dispose(): void {
    clearTimeout(this.saveTimer);
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}
