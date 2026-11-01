// Workspace trust (spec §8): nothing is sent from a restricted workspace.
import * as vscode from 'vscode';

export function isWorkspaceTrusted(): boolean {
  return vscode.workspace.isTrusted;
}
