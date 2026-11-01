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

/** Symbol kinds that get an "Explain" lens: top-level and class members (arch §6). */
const EXPLAINABLE = new Set([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Interface,
  vscode.SymbolKind.Enum,
  vscode.SymbolKind.Struct,
  vscode.SymbolKind.Module,
  vscode.SymbolKind.Namespace,
]);

/**
 * "Explain" above functions and classes (spec §3), only when `logiclens.codeLens.enabled` is on
 * and the file is not excluded. The lens carries the document key and line; the command looks
 * the symbol up again.
 */
export class ExplainCodeLens implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly subscription: vscode.Disposable;

  readonly onDidChangeCodeLenses = this.changed.event;

  constructor(
    private readonly symbols: (doc: vscode.TextDocument) => Promise<vscode.DocumentSymbol[]>,
    private readonly excluded: (uri: vscode.Uri) => Promise<boolean>,
  ) {
    this.subscription = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('logiclens.codeLens.enabled') ||
        e.affectsConfiguration('logiclens.exclude')
      ) {
        this.changed.fire();
      }
    });
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    if (
      !vscode.workspace.getConfiguration('logiclens').get<boolean>('codeLens.enabled', false) ||
      (await this.excluded(document.uri))
    ) {
      return [];
    }
    const key = document.uri.toString();
    const lenses: vscode.CodeLens[] = [];
    const visit = (symbols: readonly vscode.DocumentSymbol[], depth: number): void => {
      for (const s of symbols) {
        if (EXPLAINABLE.has(s.kind)) {
          const line = s.range.start.line;
          lenses.push(
            new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
              title: 'Explain',
              tooltip: `Explain ${s.name} with LogicLens`,
              command: 'logiclens.explainSymbol',
              arguments: [key, line + 1],
            }),
          );
        }
        // Top level and one level of members (class methods), not nested functions.
        if (depth === 0) {
          visit(s.children, 1);
        }
      }
    };
    visit(await this.symbols(document), 0);
    return lenses;
  }

  dispose(): void {
    this.subscription.dispose();
    this.changed.dispose();
  }
}
