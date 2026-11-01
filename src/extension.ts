import * as vscode from 'vscode';
import { registerHelloCommand } from './commands/hello';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerHelloCommand());
}

export function deactivate(): void {}
