// Orchestrates an explain-file request (arch §5). S1: plain Markdown, streamed into the session.
import * as vscode from 'vscode';
import type { WalkthroughView } from '../state/types';
import type { GateOutcome, RefusalReason, RequestGate, SecretsAction } from '../guard/gate';
import { pathInfo } from '../guard/settings';
import { ProviderError } from '../providers/types';
import { buildFileContext } from './context';
import { explainMarkdownSystem, explainMarkdownUser } from '../prompts/explainMarkdown';
import { SessionStore } from '../state/session';
import type { Logger } from '../util/log';

export type ExplainResult =
  | { kind: 'done' | 'stopped'; wid: string }
  | { kind: 'failed'; wid: string; message: string }
  | { kind: 'refused'; reason: RefusalReason; message: string; lines?: number[] };

export interface ExplainOptions {
  secretsAction?: SecretsAction;
}

export class ExplainService {
  constructor(
    private readonly gate: RequestGate,
    private readonly session: SessionStore,
    private readonly log: Logger,
    private readonly confirm: (message: string, action: string) => Promise<boolean>,
  ) {}

  async explainFile(
    document: vscode.TextDocument,
    options: ExplainOptions = {},
  ): Promise<ExplainResult> {
    const key = SessionStore.key(document.uri);
    if (
      this.session.isBusy(key) &&
      !(await this.confirm(
        'An explanation of this file is still streaming. Stop it and start again?',
        'Restart',
      ))
    ) {
      return { kind: 'refused', reason: 'cancelled', message: 'Cancelled.' };
    }

    // Snapshot the text now; later edits do not change what is sent.
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const info = pathInfo(document.uri);
    const displayPath = info.relPath ?? displayName(document);
    const cancel = new vscode.CancellationTokenSource();

    let outcome: GateOutcome;
    try {
      outcome = await this.gate.send(
        {
          target: {
            ...info,
            fileName: displayName(document),
            languageId: document.languageId,
            lines,
            byteLength: Buffer.byteLength(text, 'utf8'),
          },
          secretsAction: options.secretsAction,
          build: (prepared) => ({
            system: explainMarkdownSystem(),
            messages: [
              {
                role: 'user',
                text: explainMarkdownUser(
                  buildFileContext({
                    path: displayPath,
                    languageId: document.languageId,
                    lines: prepared.lines,
                    withheld: prepared.withheld,
                  }),
                ),
              },
            ],
          }),
        },
        cancel.token,
      );
    } catch (err) {
      cancel.dispose();
      throw err;
    }
    if (outcome.kind === 'refused') {
      cancel.dispose();
      return outcome;
    }

    const view: WalkthroughView = {
      id: newId(),
      fileName: displayName(document),
      providerLabel: outcome.providerLabel,
      model: outcome.model,
      status: 'streaming',
      overview: '',
      steps: [],
      summary: '',
      watch: '',
      fallbackMarkdown: '',
      notice: null,
      error: null,
      durationMs: null,
      withheld: outcome.withheld,
      stale: false,
    };
    const wid = view.id;
    this.session.set(key, { view, cancel });
    const started = Date.now();
    const finish = (status: WalkthroughView['status'], error: string | null = null): void => {
      this.session.update(key, wid, (entry) => {
        entry.view.status = status;
        entry.view.error = error;
        entry.view.durationMs = Date.now() - started;
        entry.cancel = undefined;
      });
      cancel.dispose();
      this.log.info(`explain: ${status} after ${Date.now() - started} ms`);
    };

    try {
      for await (const chunk of outcome.stream) {
        if (chunk.type === 'text') {
          this.session.appendMarkdown(key, wid, chunk.text);
        }
      }
      if (cancel.token.isCancellationRequested) {
        finish('stopped');
        return { kind: 'stopped', wid };
      }
      finish('done');
      return { kind: 'done', wid };
    } catch (err) {
      if (cancel.token.isCancellationRequested || isCategory(err, 'cancelled')) {
        finish('stopped');
        return { kind: 'stopped', wid };
      }
      const message =
        err instanceof ProviderError ? err.message : 'The explanation failed unexpectedly.';
      this.log.error(
        `explain: failed (${err instanceof ProviderError ? err.category : 'unexpected'})`,
      );
      finish('failed', message);
      return { kind: 'failed', wid, message };
    }
  }
}

function isCategory(err: unknown, category: ProviderError['category']): boolean {
  return err instanceof ProviderError && err.category === category;
}

function displayName(document: vscode.TextDocument): string {
  const path = document.uri.path;
  return path.slice(path.lastIndexOf('/') + 1) || document.fileName;
}

function newId(): string {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
