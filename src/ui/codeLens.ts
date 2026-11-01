// Step title rows (arch §6, spec §4): a CodeLens above each anchored step's first line with its
// number and title, plus Previous and Next. Titles are model text; the parser already removed
// icon syntax from them.
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import { rangesLabel } from './inlineThreads';

export class StepCodeLens implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly subscription: vscode.Disposable;

  readonly onDidChangeCodeLenses = this.changed.event;

  constructor(private readonly session: SessionStore) {
    // Structural changes only (new step, focus, status); streamed text does not move lenses.
    this.subscription = session.onDidChange(() => this.changed.fire());
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const key = SessionStore.key(document.uri);
    const entry = this.session.get(key);
    if (!entry || entry.view.fallbackMarkdown !== null) {
      return [];
    }
    const steps = entry.view.steps.filter((s) => s.anchored && s.ranges[0]);
    const lenses: vscode.CodeLens[] = [];
    steps.forEach((step, i) => {
      const first = step.ranges[0];
      if (!first || first.start > document.lineCount) {
        return;
      }
      const range = new vscode.Range(first.start - 1, 0, first.start - 1, 0);
      const marker = entry.focus === step.index ? '$(arrow-right) ' : '';
      lenses.push(
        new vscode.CodeLens(range, {
          title: `${marker}${step.index + 1} · ${step.title}  ${rangesLabel(step)}`,
          tooltip: 'Show this step',
          command: 'logiclens.focusStep',
          arguments: [key, step.index],
        }),
      );
      const prev = steps[i - 1];
      if (prev) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: '‹ Previous',
            command: 'logiclens.focusStep',
            arguments: [key, prev.index],
          }),
        );
      }
      const next = steps[i + 1];
      if (next) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: 'Next ›',
            command: 'logiclens.focusStep',
            arguments: [key, next.index],
          }),
        );
      }
    });
    return lenses;
  }

  dispose(): void {
    this.subscription.dispose();
    this.changed.dispose();
  }
}
