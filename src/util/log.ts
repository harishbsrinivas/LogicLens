// Redacting logger (arch §8). Default output is metadata only; code, prompts, and responses
// are logged only when `logiclens.debug.logPrompts` is on, and are redacted even then.
import * as vscode from 'vscode';
import { redact } from '../guard/secretScan';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Logs user code or model text, only in debug mode. */
  debugContent(label: string, text: string): void;
}

export function createLogger(channel: vscode.LogOutputChannel): Logger {
  return {
    info: (m) => channel.info(redact(m)),
    warn: (m) => channel.warn(redact(m)),
    error: (m) => channel.error(redact(m)),
    debugContent: (label, text) => {
      if (vscode.workspace.getConfiguration('logiclens').get<boolean>('debug.logPrompts')) {
        channel.info(`[debug] ${label}\n${redact(text)}`);
      }
    },
  };
}
