// Status bar item (arch §6, spec §6): the provider and model in use; click opens the provider
// picker. While busy it spins and click stops. No provider ready shows a warning state.
import * as vscode from 'vscode';
import type { ProviderRegistry } from '../providers/registry';
import type { SessionStore } from '../state/session';

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private readonly subscriptions: vscode.Disposable[];
  private version = 0;
  /** Last resolved label, kept while busy. */
  private idle = { text: '$(sparkle) LogicLens', tooltip: 'LogicLens', error: false };

  constructor(
    private readonly session: SessionStore,
    private readonly registry: ProviderRegistry,
    private readonly questionsBusy: () => boolean = () => false,
  ) {
    this.item.name = 'LogicLens';
    this.subscriptions = [
      session.onDidChange(() => this.render()),
      registry.onDidChange(() => void this.refresh()),
    ];
    this.render();
    this.item.show();
    void this.refresh();
  }

  /** Re-resolves the provider (detection only; never sends code) and re-renders. */
  async refresh(): Promise<void> {
    const current = ++this.version;
    const resolution = await this.registry.resolve();
    if (current !== this.version) {
      return;
    }
    void vscode.commands.executeCommand(
      'setContext',
      'logiclens.providerReady',
      resolution.kind === 'ready',
    );
    this.idle =
      resolution.kind === 'ready'
        ? {
            text: `$(sparkle) ${resolution.model.label}`,
            tooltip: `LogicLens: ${resolution.provider.label} · ${resolution.model.label}. Click to change.`,
            error: false,
          }
        : {
            text: '$(warning) LogicLens',
            tooltip: `${resolution.reason} Click to choose a provider.`,
            error: true,
          };
    this.render();
  }

  get text(): string {
    return this.item.text;
  }

  render(): void {
    const busy = this.session.anyBusy() || this.questionsBusy();
    void vscode.commands.executeCommand('setContext', 'logiclens.busy', busy);
    this.item.text = busy ? '$(loading~spin) LogicLens' : this.idle.text;
    this.item.tooltip = busy ? 'LogicLens is explaining. Click to stop.' : this.idle.tooltip;
    this.item.command = busy ? 'logiclens.stop' : 'logiclens.selectProvider';
    this.item.backgroundColor =
      !busy && this.idle.error ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
  }

  dispose(): void {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.item.dispose();
  }
}
