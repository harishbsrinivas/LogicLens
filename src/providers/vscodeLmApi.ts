import * as vscode from 'vscode';
import type { LmApi, LmModel } from './vscodeLm';

/** Binds the `vscode-lm` adapter to the real Language Model API, feature-detected (arch §4). */
export function vscodeLmApi(): LmApi {
  const lm = (vscode as Partial<typeof vscode>).lm;
  return {
    selectChatModels: lm
      ? async (): Promise<LmModel[]> => {
          const models = await lm.selectChatModels();
          return models.map((m) => ({
            id: m.id,
            name: m.name,
            vendor: m.vendor,
            sendRequest: (messages, token) =>
              m.sendRequest(
                messages as vscode.LanguageModelChatMessage[],
                {},
                token as vscode.CancellationToken,
              ),
          }));
        }
      : undefined,
    userMessage: (text) => vscode.LanguageModelChatMessage.User(text),
    assistantMessage: (text) => vscode.LanguageModelChatMessage.Assistant(text),
    errorCode: (err) => (err instanceof vscode.LanguageModelError ? err.code : undefined),
  };
}
