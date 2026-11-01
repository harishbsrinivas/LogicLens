import * as vscode from 'vscode';
import { registerExplainCommands } from './commands/explain';
import { registerStyleCommands } from './commands/style';
import {
  createResolver,
  registerProviderCommands,
  showPick,
  type PickFn,
} from './commands/provider';
import { registerQuestionCommands, type InputFn } from './commands/questions';
import { registerStepCommands } from './commands/steps';
import { registerTermsCommand } from './commands/terms';
import { QuestionService } from './explain/question';
import { documentSymbols, enclosingSymbol } from './explain/symbols';
import { ExplainService } from './explain/walkthrough';
import { RequestGate } from './guard/gate';
import type { Prompter } from './guard/prompter';
import {
  cliSettings,
  explanationStyle,
  guardSettings,
  isExcluded,
  isPathExcluded,
  providerSettings,
} from './guard/settings';
import { isWorkspaceTrusted } from './guard/trust';
import { createVscodePrompter } from './guard/vscodePrompter';
import { createClaudeCodeProvider } from './providers/cli/claudeCode';
import { minimalEnv } from './providers/cli/spawn';
import { workDirFactory } from './providers/cli/workDir';
import { ProviderRegistry } from './providers/registry';
import type { ProviderChoice, Provider } from './providers/types';
import { createVscodeLmProvider } from './providers/vscodeLm';
import { vscodeLmApi } from './providers/vscodeLmApi';
import { QuestionStore } from './state/questions';
import { SessionStore } from './state/session';
import { ActiveEditor } from './ui/activeEditor';
import { ExplainCodeLens, StepCodeLens } from './ui/codeLens';
import { trackFileExcluded } from './ui/contextKeys';
import { Decorations } from './ui/decorations';
import { CONTROLLER_ID, InlineThreads } from './ui/inlineThreads';
import { commentingRanges, QuestionThreads } from './ui/questionThreads';
import { StepContext } from './ui/stepContext';
import { StatusBar } from './ui/statusBar';
import { createLogger } from './util/log';

/** Returned from `activate` only in test mode, so integration tests can swap the AI and prompts. */
export interface TestApi {
  /** Replaces every adapter with this one. */
  setProvider(provider: Provider): void;
  setProviders(providers: Provider[]): void;
  /** Restores the real adapters (vscode-lm, claude-code). */
  resetProviders(): void;
  setPick(pick: PickFn): void;
  statusText(): string;
  refreshStatus(): Promise<void>;
  setPrompter(prompter: Prompter): void;
  setTrusted(trusted: boolean | undefined): void;
  setInput(input: InputFn): void;
  globalState: vscode.Memento;
  threads: InlineThreads;
  questions: QuestionThreads;
  decorations: Decorations;
}

export function activate(context: vscode.ExtensionContext): TestApi | undefined {
  const channel = vscode.window.createOutputChannel('LogicLens', { log: true });
  const log = createLogger(channel);

  // Spec §6 order: VS Code language models, then Claude Code.
  const adapters: Provider[] = [
    createVscodeLmProvider(vscodeLmApi()),
    createClaudeCodeProvider({
      binary: () => cliSettings().claudePath,
      timeoutMs: () => cliSettings().timeoutMs,
      workDir: workDirFactory(vscode.Uri.joinPath(context.globalStorageUri, 'cli').fsPath),
      env: () => minimalEnv(process.env),
    }),
  ];
  const registry = new ProviderRegistry({ providers: adapters, settings: providerSettings });
  let pick: PickFn = showPick;
  let prompter: Prompter = createVscodePrompter(context.extensionUri);
  let trustOverride: boolean | undefined;
  let input: InputFn = (prompt, value) => vscode.window.showInputBox({ prompt, value });
  const isTrusted = (): boolean => trustOverride ?? isWorkspaceTrusted();

  const gate = new RequestGate({
    state: context.globalState,
    prompter: {
      terms: () => prompter.terms(),
      openTerms: () => prompter.openTerms(),
      dataNotice: (label) => prompter.dataNotice(label),
      openUrl: (url) => prompter.openUrl(url),
      confirm: (message, action) => prompter.confirm(message, action),
    },
    isTrusted,
    isExcluded: isPathExcluded,
    settings: guardSettings,
    resolve: createResolver(registry, context.globalState, () =>
      vscode.commands.executeCommand<ProviderChoice | undefined>('logiclens.selectProvider'),
    ),
    log,
  });

  const session = new SessionStore();
  const active = new ActiveEditor();
  const controller = vscode.comments.createCommentController(CONTROLLER_ID, 'LogicLens');
  controller.commentingRangeProvider = commentingRanges(
    async (doc) => isTrusted() && !(await isExcluded(doc.uri)),
  );
  const threads = new InlineThreads(session, controller);
  const questionStore = new QuestionStore();
  const questions = new QuestionService({
    gate,
    store: questionStore,
    session,
    log,
    maxLines: () => guardSettings().maxLines,
    style: (uri) => explanationStyle(uri),
    enclosingSymbol,
  });
  const questionThreads = new QuestionThreads(controller, questionStore, (id) =>
    questions.isBusy(id),
  );
  const statusBar = new StatusBar(session, registry, () =>
    questionStore.all().some((t) => questions.isBusy(t.id)),
  );
  const decorations = new Decorations(session);
  const codeLens = new StepCodeLens(session);
  const explainLens = new ExplainCodeLens(documentSymbols, isExcluded);
  const service = new ExplainService({
    gate,
    session,
    log,
    confirm: (message, action) => prompter.confirm(message, action),
    settings: (uri) => ({
      style: explanationStyle(uri),
      maxLines: guardSettings().maxLines,
    }),
    enclosingSymbol,
  });

  context.subscriptions.push(
    channel,
    session,
    active,
    threads,
    questionStore,
    questionThreads,
    controller,
    statusBar,
    ...registerProviderCommands({
      registry,
      state: context.globalState,
      pick: () => pick,
      explain: (options, arg) =>
        vscode.commands.executeCommand('logiclens.explainFile', arg, options),
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('logiclens.provider') ||
        e.affectsConfiguration('logiclens.model') ||
        e.affectsConfiguration('logiclens.cli')
      ) {
        registry.invalidate();
      }
    }),
    vscode.extensions.onDidChange(() => registry.invalidate()),
    questionStore.onDidChange(() => statusBar.render()),
    ...watchModels(() => registry.invalidate()),
    decorations,
    codeLens,
    new StepContext(session, active),
    vscode.languages.registerCodeLensProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      codeLens,
    ),
    explainLens,
    vscode.languages.registerCodeLensProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      explainLens,
    ),
    trackFileExcluded(active),
    vscode.workspace.onDidCloseTextDocument((doc) => session.delete(SessionStore.key(doc.uri))),
    ...registerExplainCommands({ service, session, active, pick: () => pick }),
    ...registerStyleCommands({
      session,
      active,
      pick: () => pick,
      confirm: (message, action) => prompter.confirm(message, action),
    }),
    ...registerStepCommands(session, active),
    ...registerQuestionCommands({
      service: questions,
      store: questionStore,
      ui: questionThreads,
      inline: threads,
      session,
      active,
      input: () => input,
    }),
    registerTermsCommand(context.extensionUri),
  );

  if (context.extensionMode !== vscode.ExtensionMode.Test) {
    return undefined;
  }
  return {
    setProvider: (p) => registry.setProviders([p]),
    setProviders: (list) => registry.setProviders(list),
    resetProviders: () => registry.setProviders(adapters),
    setPick: (p) => (pick = p),
    statusText: () => statusBar.text,
    refreshStatus: () => statusBar.refresh(),
    setPrompter: (p) => (prompter = p),
    setTrusted: (t) => (trustOverride = t),
    setInput: (i) => (input = i),
    globalState: context.globalState,
    threads,
    questions: questionThreads,
    decorations,
  };
}

/** Re-detects when an extension adds or removes language models, where the API has the event. */
function watchModels(listener: () => void): vscode.Disposable[] {
  const lm = (vscode as Partial<typeof vscode>).lm;
  return lm?.onDidChangeChatModels ? [lm.onDidChangeChatModels(listener)] : [];
}

export function deactivate(): void {}
