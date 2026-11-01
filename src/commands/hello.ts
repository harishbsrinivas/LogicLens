import * as vscode from 'vscode';
import { HELLO_MESSAGE } from '../../shared/messages';

// S0 placeholder command; removed when S1 adds "Explain File" (plan S0).
export function registerHelloCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('clarity.hello', async () => {
    void vscode.window.showInformationMessage(HELLO_MESSAGE);
    return HELLO_MESSAGE;
  });
}
