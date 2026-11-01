// Explain commands (spec §9). Thin: resolve the target, call the service, report refusals.
import * as vscode from 'vscode';
import type { ExplainOptions, ExplainResult, ExplainService } from '../explain/walkthrough';
import { SessionStore } from '../state/session';
import type { ActiveEditor } from '../ui/activeEditor';
import type { PanelProvider } from '../ui/panel';

export function registerExplainCommands(
  service: ExplainService,
  session: SessionStore,
  active: ActiveEditor,
  panel: PanelProvider,
): vscode.Disposable[] {
  async function explainFile(options: ExplainOptions = {}): Promise<ExplainResult> {
    const editor = active.editor;
    if (!editor) {
      void vscode.window.showInformationMessage('Open a file to explain it with LogicLens.');
      return { kind: 'refused', reason: 'cancelled', message: 'No active editor.' };
    }
    if (editor.document.uri.scheme === 'vscode-notebook-cell') {
      void vscode.window.showInformationMessage('LogicLens does not explain notebooks yet.');
      return { kind: 'refused', reason: 'cancelled', message: 'Notebooks are not supported.' };
    }
    panel.reveal();
    const result = await service.explainFile(editor.document, options);
    panel.refresh();
    if (result.kind === 'refused') {
      reportRefusal(result);
    }
    return result;
  }

  // Messages are not awaited, so the command's result never waits on a toast.
  function reportRefusal(result: Extract<ExplainResult, { kind: 'refused' }>): void {
    switch (result.reason) {
      case 'terms':
      case 'cancelled':
        // The panel shows the terms state; a cancel needs no message.
        return;
      case 'excluded': {
        const open = 'Open Settings';
        void vscode.window.showWarningMessage(result.message, open).then((choice) => {
          if (choice === open) {
            void vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'logiclens.exclude',
            );
          }
        });
        return;
      }
      case 'secrets': {
        if (!result.lines?.length) {
          void vscode.window.showWarningMessage(result.message);
          return;
        }
        const skip = 'Skip those lines instead';
        void vscode.window.showWarningMessage(result.message, skip).then((choice) => {
          if (choice === skip) {
            void explainFile({ secretsAction: 'skip-lines' });
          }
        });
        return;
      }
      default:
        void vscode.window.showWarningMessage(result.message);
        return;
    }
  }

  return [
    vscode.commands.registerCommand('logiclens.explainFile', () => explainFile()),
    vscode.commands.registerCommand('logiclens.stop', () => {
      const editor = active.editor;
      if (editor && session.isBusy(SessionStore.key(editor.document.uri))) {
        session.stop(SessionStore.key(editor.document.uri));
        return;
      }
      session.stopAll();
    }),
  ];
}
