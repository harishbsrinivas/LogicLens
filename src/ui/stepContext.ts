// Keeps walkthrough context in step with the editor (spec §4, §9): context keys for menus and
// keybindings, follow-cursor focus, and marking a walkthrough stale when its document is edited
// (per-step tracking comes in S8).
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import type { ActiveEditor } from './activeEditor';

const FOLLOW_DEBOUNCE_MS = 100;

export class StepContext implements vscode.Disposable {
  private followTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscriptions: vscode.Disposable[];

  constructor(
    private readonly session: SessionStore,
    private readonly active: ActiveEditor,
  ) {
    this.subscriptions = [
      active.onDidChange(() => this.updateKeys()),
      session.onDidChange(() => this.updateKeys()),
      vscode.window.onDidChangeTextEditorSelection((e) => this.onSelection(e)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0) {
          session.markStale(SessionStore.key(e.document.uri));
        }
      }),
    ];
    this.updateKeys();
  }

  private updateKeys(): void {
    const editor = this.active.editor;
    const entry = editor && this.session.get(SessionStore.key(editor.document.uri));
    const active = Boolean(
      entry && entry.view.fallbackMarkdown === null && entry.view.steps.some((s) => s.anchored),
    );
    void vscode.commands.executeCommand('setContext', 'logiclens.walkthroughActive', active);
    void vscode.commands.executeCommand(
      'setContext',
      'logiclens.stepFocused',
      active && entry?.focus !== null,
    );
  }

  // Follow mode moves the highlight to the step under the cursor, without scrolling or opening
  // its thread. It only acts while a step is focused, so Escape turns it off until the next focus.
  private onSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind === vscode.TextEditorSelectionChangeKind.Command || e.kind === undefined) {
      return;
    }
    if (!vscode.workspace.getConfiguration('logiclens').get<boolean>('followCursor', true)) {
      return;
    }
    if (this.followTimer) {
      clearTimeout(this.followTimer);
    }
    const editor = e.textEditor;
    this.followTimer = setTimeout(() => {
      this.followTimer = undefined;
      const key = SessionStore.key(editor.document.uri);
      const entry = this.session.get(key);
      if (!entry || entry.focus === null || entry.view.fallbackMarkdown !== null) {
        return;
      }
      const line = editor.selection.active.line + 1;
      const step = entry.view.steps.find(
        (s) => s.anchored && s.ranges.some((r) => r.start <= line && line <= r.end),
      );
      if (step) {
        this.session.setFocus(key, step.index, false);
      }
    }, FOLLOW_DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.followTimer) {
      clearTimeout(this.followTimer);
    }
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}
