// Explain commands (spec §9). Thin: resolve the target, call the service, report refusals.
import * as vscode from 'vscode';
import type { ExplainOptions, ExplainResult, ExplainService } from '../explain/walkthrough';
import { SessionStore } from '../state/session';
import type { ActiveEditor } from '../ui/activeEditor';
import { reportRefusal as reportRefusalMessage, showWithChooseProvider } from './refusals';
import { threadUri } from './steps';

export function registerExplainCommands(
  service: ExplainService,
  session: SessionStore,
  active: ActiveEditor,
): vscode.Disposable[] {
  // Thread title actions pass their comment thread; the palette and editor title pass nothing.
  function targetEditor(arg: unknown): vscode.TextEditor | undefined {
    const uri = threadUri(arg);
    if (!uri) {
      return active.editor;
    }
    return vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString(),
    );
  }

  async function explainFile(options: ExplainOptions = {}, arg?: unknown): Promise<ExplainResult> {
    const editor = targetEditor(arg);
    if (!editor) {
      void vscode.window.showInformationMessage('Open a file to explain it with LogicLens.');
      return { kind: 'refused', reason: 'cancelled', message: 'No active editor.' };
    }
    if (editor.document.uri.scheme === 'vscode-notebook-cell') {
      void vscode.window.showInformationMessage('LogicLens does not explain notebooks yet.');
      return { kind: 'refused', reason: 'cancelled', message: 'Notebooks are not supported.' };
    }
    const result = await service.explainFile(editor.document, options);
    if (result.kind === 'refused') {
      reportRefusal(result);
    } else if (
      result.kind === 'failed' &&
      (result.category === 'auth' || result.category === 'quota' || result.category === 'not-found')
    ) {
      showWithChooseProvider(result.message);
    }
    return result;
  }

  function reportRefusal(result: Extract<ExplainResult, { kind: 'refused' }>): void {
    reportRefusalMessage(result, () => void explainFile({ secretsAction: 'skip-lines' }));
  }

  return [
    // The second argument comes only from Regenerate with…; its shape is checked.
    vscode.commands.registerCommand('logiclens.explainFile', (arg?: unknown, options?: unknown) =>
      explainFile(providerOverride(options), arg),
    ),
    vscode.commands.registerCommand('logiclens.stop', (arg?: unknown) => {
      const editor = targetEditor(arg);
      if (editor && session.isBusy(SessionStore.key(editor.document.uri))) {
        session.stop(SessionStore.key(editor.document.uri));
        return;
      }
      session.stopAll();
    }),
    vscode.commands.registerCommand('logiclens.continue', async (arg?: unknown) => {
      const editor = targetEditor(arg);
      if (!editor) {
        return undefined;
      }
      const result = await service.continue(editor.document);
      if (result.kind === 'refused' && result.reason !== 'cancelled') {
        reportRefusal(result);
      }
      return result;
    }),
    vscode.commands.registerCommand('logiclens.closeExplanation', (arg?: unknown) => {
      const uri = threadUri(arg) ?? active.editor?.document.uri;
      if (uri) {
        session.delete(SessionStore.key(uri));
      }
    }),
  ];
}

function providerOverride(options: unknown): ExplainOptions {
  if (typeof options !== 'object' || options === null || !('provider' in options)) {
    return {};
  }
  const p = options.provider;
  if (
    typeof p === 'object' &&
    p !== null &&
    'provider' in p &&
    typeof p.provider === 'string' &&
    (!('model' in p) || typeof p.model === 'string')
  ) {
    return { provider: { provider: p.provider, model: 'model' in p ? (p.model as string) : '' } };
  }
  return {};
}
