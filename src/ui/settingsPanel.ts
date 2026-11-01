// LogicLens settings page (spec §16, ADR-0031): the only webview. Strict CSP with a per-load
// nonce, scripts and styles only from the extension's own files, no remote resources, and every
// message from the page validated against the settings schema before anything is written.
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { ProviderRegistry } from '../providers/registry';
import { SECTIONS, SETTINGS, validateSetting } from '../settings/schema';
import { stateText } from './providerPicker';

/** Commands the page's buttons may run; nothing else. */
const ACTIONS: Record<string, string> = {
  selectProvider: 'logiclens.selectProvider',
  resetDataNotices: 'logiclens.resetDataNotices',
  clearCache: 'logiclens.clearCache',
  viewTerms: 'logiclens.viewTerms',
  showLog: 'logiclens.showLog',
  openSettingsJson: 'workbench.action.openSettingsJson',
};

export interface SettingsPanelDeps {
  extensionUri: vscode.Uri;
  registry: ProviderRegistry;
}

export class SettingsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];
  /** Messages posted to the page; integration tests read them. */
  readonly sent: unknown[] = [];

  constructor(private readonly deps: SettingsPanelDeps) {}

  get html(): string {
    return this.panel?.webview.html ?? '';
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    const root = vscode.Uri.joinPath(this.deps.extensionUri, 'dist', 'webview');
    const media = vscode.Uri.joinPath(this.deps.extensionUri, 'media');
    const panel = vscode.window.createWebviewPanel(
      'logiclens.settings',
      'LogicLens Settings',
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [root, media], enableCommandUris: false },
    );
    panel.iconPath = vscode.Uri.joinPath(media, 'logiclens.svg');
    panel.webview.html = page(panel.webview, root, media);
    this.panel = panel;
    const listeners = [
      panel.webview.onDidReceiveMessage((m: unknown) => void this.receive(m)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('logiclens')) {
          void this.postState();
        }
      }),
      this.deps.registry.onDidChange(() => void this.postState()),
    ];
    panel.onDidDispose(() => {
      listeners.forEach((l) => l.dispose());
      this.panel = undefined;
    });
  }

  /** Handles one message from the page. Public so integration tests can act as the page. */
  async receive(message: unknown): Promise<void> {
    if (typeof message !== 'object' || message === null || !('type' in message)) {
      return;
    }
    const m = message as { type: unknown; key?: unknown; value?: unknown; name?: unknown };
    if (m.type === 'ready') {
      await this.postState();
    } else if (m.type === 'set') {
      const result = validateSetting(m.key, m.value);
      if (!result.ok) {
        this.post({
          type: 'error',
          key: typeof m.key === 'string' ? m.key : '',
          message: result.error,
        });
        return;
      }
      // User settings only: the page never writes workspace settings (spec §16).
      await vscode.workspace
        .getConfiguration('logiclens')
        .update(result.spec.key, result.value, vscode.ConfigurationTarget.Global);
      await this.postState();
    } else if (m.type === 'reset') {
      const spec = SETTINGS.find((s) => s.key === m.key);
      if (spec) {
        await vscode.workspace
          .getConfiguration('logiclens')
          .update(spec.key, undefined, vscode.ConfigurationTarget.Global);
        await this.postState();
      }
    } else if (
      m.type === 'action' &&
      typeof m.name === 'string' &&
      Object.hasOwn(ACTIONS, m.name)
    ) {
      const command = ACTIONS[m.name];
      if (command) {
        await vscode.commands.executeCommand(command);
      }
      await this.postState();
    }
  }

  private async postState(): Promise<void> {
    if (!this.panel) {
      return;
    }
    const config = vscode.workspace.getConfiguration('logiclens');
    const statuses = await this.deps.registry.detectAll();
    this.post({
      type: 'state',
      state: {
        sections: SECTIONS,
        settings: SETTINGS.map((s) => {
          const info = config.inspect(s.key);
          const workspace = info?.workspaceFolderValue ?? info?.workspaceValue;
          return {
            key: s.key,
            section: s.section,
            label: s.label,
            type: s.type,
            scope: s.scope,
            options: s.options,
            min: s.min,
            help: s.help,
            // The page edits the user value; the default shows when there is none.
            value: info?.globalValue ?? info?.defaultValue,
            isDefault: info?.globalValue === undefined,
            // Machine and application settings ignore workspace values, so only note resource ones.
            workspaceValue: s.scope === 'resource' ? workspace : undefined,
          };
        }),
        providers: statuses.map(({ provider, state }) => ({
          id: provider.id,
          label: provider.label,
          state: stateText(state),
          ready: state.kind === 'ready',
          reason: state.kind === 'ready' ? '' : state.reason,
          models: state.kind === 'ready' ? state.models : [],
        })),
      },
    });
  }

  private post(message: unknown): void {
    this.sent.push(message);
    void this.panel?.webview.postMessage(message);
  }

  dispose(): void {
    this.panel?.dispose();
    this.subscriptions.forEach((s) => s.dispose());
  }
}

function page(webview: vscode.Webview, root: vscode.Uri, media: vscode.Uri): string {
  const nonce = randomBytes(16).toString('base64');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(root, 'settings.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(media, 'settings.css'));
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style.toString()}">
<title>LogicLens Settings</title>
</head>
<body>
<main id="app"><p>Loading…</p></main>
<script nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
}
