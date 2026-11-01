import * as vscode from 'vscode';
import { registerExplainCommands } from './commands/explain';
import { registerStepCommands } from './commands/steps';
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
import { StepCodeLens } from './ui/codeLens';
import { trackFileExcluded } from './ui/contextKeys';
import { Decorations } from './ui/decorations';
import { InlineThreads } from './ui/inlineThreads';
import { StepContext } from './ui/stepContext';
import { StatusBar } from './ui/statusBar';
import { createLogger } from './util/log';

/** Returned from `activate` only in test mode, so integration tests can swap the AI and prompts. */
export interface TestApi {
  setProvider(provider: Provider): void;
  setPrompter(prompter: Prompter): void;
  setTrusted(trusted: boolean | undefined): void;
  globalState: vscode.Memento;
  threads: InlineThreads;
  decorations: Decorations;
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
  const threads = new InlineThreads(session);
  const decorations = new Decorations(session);
  const codeLens = new StepCodeLens(session);
  const service = new ExplainService(gate, session, log, (message, action) =>
    prompter.confirm(message, action),
  );

  context.subscriptions.push(
    channel,
    session,
    active,
    threads,
    new StatusBar(session),
    decorations,
    codeLens,
    new StepContext(session, active),
    vscode.languages.registerCodeLensProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      codeLens,
    ),
    trackFileExcluded(active),
    vscode.workspace.onDidCloseTextDocument((doc) => session.delete(SessionStore.key(doc.uri))),
    ...registerExplainCommands(service, session, active),
    ...registerStepCommands(session, active),
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
    threads,
    decorations,
  };
}

export function deactivate(): void {}
