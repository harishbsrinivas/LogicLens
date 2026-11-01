// User-facing messages for gate refusals, shared by explain and question commands (spec §8).
import * as vscode from 'vscode';

export interface Refusal {
  reason: string;
  message: string;
  lines?: number[];
}

/** Not awaited by callers, so a command's result never waits on a toast. */
export function reportRefusal(result: Refusal, skipLines?: () => void): void {
  switch (result.reason) {
    case 'terms':
    case 'cancelled':
      // The terms prompt already said what happened; a cancel needs no message.
      return;
    case 'excluded': {
      const open = 'Open Settings';
      void vscode.window.showWarningMessage(result.message, open).then((choice) => {
        if (choice === open) {
          void vscode.commands.executeCommand('workbench.action.openSettings', 'logiclens.exclude');
        }
      });
      return;
    }
    case 'secrets': {
      if (!result.lines?.length || !skipLines) {
        void vscode.window.showWarningMessage(result.message);
        return;
      }
      const skip = 'Skip those lines instead';
      void vscode.window.showWarningMessage(result.message, skip).then((choice) => {
        if (choice === skip) {
          skipLines();
        }
      });
      return;
    }
    case 'provider-unavailable':
      showWithChooseProvider(result.message);
      return;
    default:
      void vscode.window.showWarningMessage(result.message);
      return;
  }
}

/** Errors that a different provider or model would fix get one action (spec §6). */
export function showWithChooseProvider(message: string): void {
  const choose = 'Choose Provider';
  void vscode.window.showWarningMessage(message, choose).then((choice) => {
    if (choice === choose) {
      void vscode.commands.executeCommand('logiclens.selectProvider');
    }
  });
}
