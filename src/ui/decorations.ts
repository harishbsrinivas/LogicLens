// Editor decorations (arch §6). S1: lock icon on lines withheld by the secret scan.
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';

// Gutter icons must be images; theme variables are not available, so light and dark variants.
function lockIcon(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="none" stroke="${color}" stroke-width="1.3" d="M5 7V5a3 3 0 0 1 6 0v2"/><rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

export class Decorations implements vscode.Disposable {
  private readonly withheld = vscode.window.createTextEditorDecorationType({
    light: { gutterIconPath: lockIcon('#6c6c6c') },
    dark: { gutterIconPath: lockIcon('#a0a0a0') },
    gutterIconSize: '75%',
  });
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly session: SessionStore) {
    this.subscriptions = [
      vscode.window.onDidChangeVisibleTextEditors(() => this.applyAll()),
      session.onDidChange(() => this.applyAll()),
    ];
    this.applyAll();
  }

  private applyAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const view = this.session.get(SessionStore.key(editor.document.uri))?.view;
      const lines = (view?.withheld ?? []).filter((l) => l <= editor.document.lineCount);
      editor.setDecorations(
        this.withheld,
        lines.map((l) => ({
          range: new vscode.Range(l - 1, 0, l - 1, 0),
          hoverMessage: 'Withheld by LogicLens: possible secret. This line was not sent.',
        })),
      );
    }
  }

  dispose(): void {
    this.withheld.dispose();
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}
