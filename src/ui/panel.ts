// LogicLens panel: webview view provider and message bridge (arch §6, ADR-0009).
import * as vscode from 'vscode';
import type { HostToWebviewMessage, PanelState, WebviewToHostMessage } from '../../shared/messages';
import { isExcluded } from '../guard/settings';
import { termsAccepted } from '../guard/terms';
import type { KeyValueStore } from '../guard/prompter';
import { SessionStore } from '../state/session';
import type { Logger } from '../util/log';
import type { ActiveEditor } from './activeEditor';
import { parseWebviewMessage } from './validate';

export const PANEL_VIEW_ID = 'logiclens.panel';
const DELTA_FLUSH_MS = 30;

export class PanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private sessionId = '';
  private pending: { key: string; wid: string; text: string } | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private stateVersion = 0;
  private readyCount = 0;
  private readonly subscriptions: vscode.Disposable[];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly session: SessionStore,
    private readonly active: ActiveEditor,
    private readonly globalState: KeyValueStore,
    private readonly log: Logger,
  ) {
    this.subscriptions = [
      active.onDidChange(() => void this.postState()),
      session.onDidChange((key) => {
        if (key === this.activeKey()) {
          void this.postState();
        }
      }),
      session.onDelta((d) => this.queueDelta(d)),
    ];
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.sessionId = nonce();
    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    view.webview.options = { enableScripts: true, localResourceRoots: [webviewRoot] };
    view.webview.html = this.html(view.webview, webviewRoot);
    view.webview.onDidReceiveMessage((raw: unknown) => {
      const msg = parseWebviewMessage(raw, this.sessionId);
      if (!msg) {
        this.log.warn('panel: dropped an invalid or stale message');
        return;
      }
      void this.handle(msg);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
      }
    });
  }

  /** Times the webview script loaded and said `ready`; integration tests use it. */
  get webviewReadyCount(): number {
    return this.readyCount;
  }

  /** Shows the panel without taking focus from the editor. */
  reveal(): void {
    if (this.view) {
      this.view.show(true);
    } else {
      void vscode.commands.executeCommand(`${PANEL_VIEW_ID}.focus`, { preserveFocus: true });
    }
  }

  /** Re-sends the full state, for example after terms were accepted. */
  refresh(): void {
    void this.postState();
  }

  private activeKey(): string | undefined {
    const editor = this.active.editor;
    return editor ? SessionStore.key(editor.document.uri) : undefined;
  }

  private async handle(msg: WebviewToHostMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.readyCount++;
        await this.postState();
        return;
      case 'explain':
        await vscode.commands.executeCommand('logiclens.explainFile');
        return;
      case 'stop':
        await vscode.commands.executeCommand('logiclens.stop');
        return;
      case 'viewTerms':
        await vscode.commands.executeCommand('logiclens.viewTerms');
        return;
      case 'openLink':
        await vscode.env.openExternal(vscode.Uri.parse(msg.href, true));
        return;
      case 'revealLine': {
        const editor = this.active.editor;
        if (!editor || msg.line > editor.document.lineCount) {
          return;
        }
        const range = new vscode.Range(msg.line - 1, 0, msg.line - 1, 0);
        await vscode.window.showTextDocument(editor.document, {
          viewColumn: editor.viewColumn,
          selection: range,
        });
        return;
      }
      default:
        // Messages for later slices (steps, continue) are ignored in S1.
        return;
    }
  }

  async computeState(): Promise<PanelState> {
    const editor = this.active.editor;
    if (!editor) {
      return { kind: 'noEditor' };
    }
    const document = editor.document;
    const entry = this.session.get(SessionStore.key(document.uri));
    if (entry) {
      return { kind: 'walkthrough', walkthrough: entry.view, focus: null };
    }
    const fileName = document.uri.path.slice(document.uri.path.lastIndexOf('/') + 1);
    if (await isExcluded(document.uri)) {
      return { kind: 'excluded', fileName };
    }
    return { kind: 'empty', fileName, termsAccepted: termsAccepted(this.globalState) };
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }
    // Drop stale snapshots when state changes faster than the exclusion check resolves.
    const version = ++this.stateVersion;
    const state = await this.computeState();
    if (version !== this.stateVersion) {
      return;
    }
    // The snapshot already holds any text still waiting in the delta buffer.
    this.clearPending();
    this.post({ type: 'state', state, sessionId: this.sessionId });
  }

  private queueDelta(d: { key: string; wid: string; text: string }): void {
    if (d.key !== this.activeKey()) {
      return;
    }
    if (this.pending && this.pending.wid !== d.wid) {
      this.flush();
    }
    this.pending = this.pending ? { ...d, text: this.pending.text + d.text } : d;
    this.flushTimer ??= setTimeout(() => this.flush(), DELTA_FLUSH_MS);
  }

  private flush(): void {
    const pending = this.pending;
    this.clearPending();
    if (pending && pending.key === this.activeKey()) {
      this.post({
        type: 'markdownDelta',
        wid: pending.wid,
        text: pending.text,
        sessionId: this.sessionId,
      });
    }
  }

  private clearPending(): void {
    this.pending = undefined;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private post(message: HostToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview, root: vscode.Uri): string {
    const n = nonce();
    const script = webview.asWebviewUri(vscode.Uri.joinPath(root, 'main.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(root, 'main.css'));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource}`,
      `script-src 'nonce-${n}'`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style.toString()}">
<title>LogicLens</title>
</head>
<body>
<div id="root" data-session="${this.sessionId}"></div>
<script nonce="${n}" type="module" src="${script.toString()}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.clearPending();
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
