import * as vscode from 'vscode';
import { openTermsFile } from '../guard/vscodePrompter';

export function registerTermsCommand(extensionUri: vscode.Uri): vscode.Disposable {
  return vscode.commands.registerCommand('logiclens.viewTerms', () => openTermsFile(extensionUri));
}
