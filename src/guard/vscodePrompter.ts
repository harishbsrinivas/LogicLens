// Modal prompts for the gate (spec §8). Wording of the terms and notice modals is set there.
import * as vscode from 'vscode';
import type { NoticeChoice, Prompter, TermsChoice } from './prompter';

export const TERMS_FILE = 'TERMS.md';

export async function openTermsFile(extensionUri: vscode.Uri): Promise<void> {
  const uri = vscode.Uri.joinPath(extensionUri, TERMS_FILE);
  try {
    await vscode.commands.executeCommand('markdown.showPreview', uri);
  } catch {
    await vscode.window.showTextDocument(uri, { preview: true });
  }
}

export function createVscodePrompter(extensionUri: vscode.Uri): Prompter {
  return {
    async terms(): Promise<TermsChoice> {
      const agree = 'I Agree';
      const view = 'View Full Terms';
      const choice = await vscode.window.showInformationMessage(
        'LogicLens Terms of Use',
        {
          modal: true,
          detail: [
            'By continuing you agree that:',
            '• LogicLens is provided "as is", without warranty. Its developers are not liable for any damage or loss arising from its use, including code you send to an AI provider and any reliance on its explanations.',
            "• You are bound by your organization's IT, security, and AI-usage policies, and you are responsible for following them.",
            '• You will not use LogicLens with internal, confidential, highly confidential, restricted, eyes-only, or similarly classified code or documents, or any code you are not authorized to share with your AI provider.',
          ].join('\n'),
        },
        agree,
        view,
      );
      return choice === agree ? 'agree' : choice === view ? 'view' : 'cancel';
    },

    openTerms: () => openTermsFile(extensionUri),

    async dataNotice(providerLabel: string): Promise<NoticeChoice> {
      const cont = 'Continue';
      const view = 'View terms';
      const choice = await vscode.window.showInformationMessage(
        `LogicLens will send the selected code and your questions to ${providerLabel} to generate explanations.`,
        {
          modal: true,
          detail: `LogicLens has no server of its own. ${providerLabel}'s terms apply.`,
        },
        view,
        cont,
      );
      return choice === cont ? 'continue' : choice === view ? 'view' : 'cancel';
    },

    async openUrl(url: string): Promise<void> {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    },

    async confirm(message: string, action: string): Promise<boolean> {
      return (await vscode.window.showWarningMessage(message, { modal: true }, action)) === action;
    },
  };
}
