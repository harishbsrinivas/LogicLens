// Status bar item (arch §6). S1: static label with a busy indicator; the picker comes in S5.
import * as vscode from 'vscode';
import type { SessionStore } from '../state/session';

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private readonly subscription: vscode.Disposable;

  constructor(private readonly session: SessionStore) {
    this.item.name = 'LogicLens';
    this.subscription = session.onDidChange(() => this.update());
    this.update();
    this.item.show();
  }

  private update(): void {
    const busy = this.session.anyBusy();
    void vscode.commands.executeCommand('setContext', 'logiclens.busy', busy);
    this.item.text = busy ? '$(loading~spin) LogicLens' : '$(sparkle) LogicLens';
    this.item.tooltip = busy ? 'LogicLens is explaining. Click to stop.' : 'LogicLens';
    this.item.command = busy ? 'logiclens.stop' : undefined;
  }

  dispose(): void {
    this.subscription.dispose();
    this.item.dispose();
  }
}
