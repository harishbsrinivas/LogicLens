// Step navigation commands (spec §4, §9). Focus lives in the session; this resolves the editor,
// moves the cursor to the step, and reveals it.
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import type { StepView } from '../state/types';
import type { ActiveEditor } from '../ui/activeEditor';
import { stepLine } from '../ui/inlineThreads';

export function registerStepCommands(
  session: SessionStore,
  active: ActiveEditor,
): vscode.Disposable[] {
  /** Steps that can be focused: those tied to lines, in walkthrough order. */
  function navigable(key: string): StepView[] {
    const view = session.get(key)?.view;
    return view && view.fallbackMarkdown === null ? view.steps.filter((s) => s.anchored) : [];
  }

  function focus(editor: vscode.TextEditor, index: number): void {
    const key = SessionStore.key(editor.document.uri);
    const steps = navigable(key);
    const step = steps.find((s) => s.index === index);
    const first = step?.ranges[0];
    if (!step || !first) {
      return;
    }
    session.setFocus(key, index, true);
    const last = step.ranges[step.ranges.length - 1] ?? first;
    const start = new vscode.Position(first.start - 1, 0);
    editor.selection = new vscode.Selection(start, start);
    editor.revealRange(
      new vscode.Range(stepLine(first.start), 0, last.end - 1, 0),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
    const position = steps.indexOf(step) + 1;
    const lines =
      first.start === last.end ? `line ${first.start}` : `lines ${first.start} to ${last.end}`;
    // Read by screen readers through the status bar; S2 confirms this in the demo (ADR-0028).
    vscode.window.setStatusBarMessage(
      `Step ${position} of ${steps.length}, ${step.title}, ${lines}`,
      5000,
    );
  }

  function move(delta: 1 | -1): void {
    const editor = active.editor;
    if (!editor) {
      return;
    }
    const key = SessionStore.key(editor.document.uri);
    const steps = navigable(key);
    if (steps.length === 0) {
      return;
    }
    const current = steps.findIndex((s) => s.index === session.get(key)?.focus);
    const next =
      current === -1
        ? delta === 1
          ? 0
          : steps.length - 1
        : Math.min(steps.length - 1, Math.max(0, current + delta));
    const step = steps[next];
    if (step) {
      focus(editor, step.index);
    }
  }

  return [
    vscode.commands.registerCommand('logiclens.nextStep', () => move(1)),
    vscode.commands.registerCommand('logiclens.previousStep', () => move(-1)),
    vscode.commands.registerCommand('logiclens.clearFocus', () => {
      const editor = active.editor;
      if (editor) {
        session.setFocus(SessionStore.key(editor.document.uri), null, false);
      }
    }),
    // From the step title CodeLens: arguments come from our own lenses but are checked anyway.
    vscode.commands.registerCommand('logiclens.focusStep', (uri: unknown, index: unknown) => {
      if (typeof uri !== 'string' || typeof index !== 'number' || !Number.isSafeInteger(index)) {
        return;
      }
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === uri,
      );
      if (editor && session.get(uri)) {
        focus(editor, index);
      }
    }),
    vscode.commands.registerCommand('logiclens.showAllSteps', (arg?: unknown) => {
      const uri = threadUri(arg) ?? active.editor?.document.uri;
      if (!uri) {
        return;
      }
      const key = SessionStore.key(uri);
      const entry = session.get(key);
      if (entry) {
        session.setShowAll(key, !entry.showAll);
      }
    }),
  ];
}

export function threadUri(arg: unknown): vscode.Uri | undefined {
  if (typeof arg === 'object' && arg !== null && 'uri' in arg && arg.uri instanceof vscode.Uri) {
    return arg.uri;
  }
  return undefined;
}
