// The editor LogicLens acts on. Focusing the panel clears `activeTextEditor` in some layouts,
// so the last text editor is kept while it is still visible.
import * as vscode from 'vscode';

export class ActiveEditor implements vscode.Disposable {
  private last: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly subscriptions: vscode.Disposable[];

  readonly onDidChange = this.changed.event;

  constructor() {
    this.subscriptions = [
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.last = editor;
        }
        this.changed.fire();
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.changed.fire()),
    ];
  }

  get editor(): vscode.TextEditor | undefined {
    const active = vscode.window.activeTextEditor;
    if (active) {
      return active;
    }
    const last = this.last;
    return last && vscode.window.visibleTextEditors.find((e) => e.document === last.document);
  }

  dispose(): void {
    this.changed.dispose();
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}
