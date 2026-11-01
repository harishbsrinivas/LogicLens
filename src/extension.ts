import * as vscode from 'vscode';
import { registerExplainCommands } from './commands/explain';
import { registerTermsCommand } from './commands/terms';
import { ExplainService } from './explain/walkthrough';
import { RequestGate } from './guard/gate';
import type { Prompter } from './guard/prompter';
import { guardSettings, isPathExcluded } from './guard/settings';
import { isWorkspaceTrusted } from './guard/trust';
import { createVscodePrompter } from './guard/vscodePrompter';
import type { Provider } from './providers/types';
import { createVscodeLmProvider } from './providers/vscodeLm';
import { vscodeLmApi } from './providers/vscodeLmApi';
import { SessionStore } from './state/session';
import { ActiveEditor } from './ui/activeEditor';
import { trackFileExcluded } from './ui/contextKeys';
import { Decorations } from './ui/decorations';
import { PANEL_VIEW_ID, PanelProvider } from './ui/panel';
import { StatusBar } from './ui/statusBar';
import { createLogger } from './util/log';

/** Returned from `activate` only in test mode, so integration tests can swap the AI and prompts. */
export interface TestApi {
  setProvider(provider: Provider): void;
  setPrompter(prompter: Prompter): void;
  setTrusted(trusted: boolean | undefined): void;
  globalState: vscode.Memento;
  panel: PanelProvider;
}

export function activate(context: vscode.ExtensionContext): TestApi | undefined {
  const channel = vscode.window.createOutputChannel('LogicLens', { log: true });
  const log = createLogger(channel);

  let provider: Provider = createVscodeLmProvider(vscodeLmApi());
  let prompter: Prompter = createVscodePrompter(context.extensionUri);
  let trustOverride: boolean | undefined;

  const gate = new RequestGate({
    state: context.globalState,
    prompter: {
      terms: () => prompter.terms(),
      openTerms: () => prompter.openTerms(),
      dataNotice: (label) => prompter.dataNotice(label),
      openUrl: (url) => prompter.openUrl(url),
      confirm: (message, action) => prompter.confirm(message, action),
    },
    isTrusted: () => trustOverride ?? isWorkspaceTrusted(),
    isExcluded: isPathExcluded,
    settings: guardSettings,
    provider: () => provider,
    log,
  });

  const session = new SessionStore();
  const active = new ActiveEditor();
  const panel = new PanelProvider(context.extensionUri, session, active, context.globalState, log);
  const service = new ExplainService(gate, session, log, (message, action) =>
    prompter.confirm(message, action),
  );

  context.subscriptions.push(
    channel,
    session,
    active,
    panel,
    new StatusBar(session),
    new Decorations(session),
    trackFileExcluded(active),
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, panel),
    vscode.workspace.onDidCloseTextDocument((doc) => session.delete(SessionStore.key(doc.uri))),
    ...registerExplainCommands(service, session, active, panel),
    registerTermsCommand(context.extensionUri),
  );

  if (context.extensionMode !== vscode.ExtensionMode.Test) {
    return undefined;
  }
  return {
    setProvider: (p) => (provider = p),
    setPrompter: (p) => (prompter = p),
    setTrusted: (t) => (trustOverride = t),
    globalState: context.globalState,
    panel,
  };
}

export function deactivate(): void {}
