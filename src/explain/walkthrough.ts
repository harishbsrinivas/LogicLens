// Orchestrates a walkthrough request (arch §5): gate, prompt, stream, parse, anchor, state.
import * as vscode from 'vscode';
import type { GateOutcome, RefusalReason, RequestGate, SecretsAction } from '../guard/gate';
import { pathInfo } from '../guard/settings';
import type { ChatMessage, ProviderChoice, ProviderErrorCategory } from '../providers/types';
import { ProviderError } from '../providers/types';
import type { ExplanationStyle } from '../prompts/style';
import { continueUser, walkthroughSystem, walkthroughUser } from '../prompts/walkthrough';
import { SessionStore } from '../state/session';
import { canContinue, type LineRange, type StepView, type WalkthroughView } from '../state/types';
import type { Logger } from '../util/log';
import { anchorRanges } from './anchor';
import {
  buildFileContext,
  buildWindowContext,
  CONTEXT_BUDGET_CHARS,
  contextWindow,
} from './context';
import { ProtocolParser, type ProtocolEvent } from './protocol';

export type ExplainResult =
  | { kind: 'done' | 'stopped' | 'truncated'; wid: string }
  | { kind: 'failed'; wid: string; message: string; category?: ProviderErrorCategory }
  | { kind: 'refused'; reason: RefusalReason; message: string; lines?: number[] };

export interface ExplainOptions {
  secretsAction?: SecretsAction;
  /** One-request provider and model, from "Regenerate with…" (spec §6). */
  provider?: ProviderChoice;
  /** Selection or symbol lines (1-based); the whole file when absent (spec §3). */
  target?: LineRange;
}

export interface ExplainSettings {
  style: ExplanationStyle;
  maxLines: number;
}

export interface ExplainDeps {
  gate: RequestGate;
  session: SessionStore;
  log: Logger;
  confirm(message: string, action: string): Promise<boolean>;
  settings(uri: vscode.Uri): ExplainSettings;
  enclosingSymbol(document: vscode.TextDocument, range: LineRange): Promise<LineRange | undefined>;
}

export const NOT_STRUCTURED_NOTICE = 'Shown as plain text: the model did not return steps.';
export const UNANCHORED_NOTICE =
  'Shown as plain text: most steps could not be tied to lines in this file.';

export class ExplainService {
  private readonly gate: RequestGate;
  private readonly session: SessionStore;
  private readonly log: Logger;

  constructor(private readonly deps: ExplainDeps) {
    this.gate = deps.gate;
    this.session = deps.session;
    this.log = deps.log;
  }

  /** Explains the file, or `options.target` within it. */
  async explainFile(
    document: vscode.TextDocument,
    options: ExplainOptions = {},
  ): Promise<ExplainResult> {
    const key = SessionStore.key(document.uri);
    if (
      this.session.isBusy(key) &&
      !(await this.deps.confirm(
        'An explanation of this file is still streaming. Stop it and start again?',
        'Restart',
      ))
    ) {
      return { kind: 'refused', reason: 'cancelled', message: 'Cancelled.' };
    }
    return this.run(document, options, (context, target) => [
      { role: 'user', text: walkthroughUser(context, target) },
    ]);
  }

  /** Asks for the remaining steps of a truncated or failed walkthrough (spec §4). */
  async continue(document: vscode.TextDocument): Promise<ExplainResult> {
    const key = SessionStore.key(document.uri);
    const entry = this.session.get(key);
    if (!entry || entry.cancel || !canContinue(entry.view)) {
      return { kind: 'refused', reason: 'cancelled', message: 'Nothing to continue.' };
    }
    if (entry.view.stale) {
      void vscode.window.showInformationMessage(
        'The file changed since this explanation was made. Explain it again instead.',
      );
      return { kind: 'refused', reason: 'cancelled', message: 'File changed.' };
    }
    const raw = entry.raw;
    return this.run(
      document,
      { target: entry.view.target ?? undefined },
      (context, target) => [
        { role: 'user', text: walkthroughUser(context, target) },
        { role: 'assistant', text: raw },
        { role: 'user', text: continueUser() },
      ],
      entry.view,
    );
  }

  private async run(
    document: vscode.TextDocument,
    options: ExplainOptions,
    messages: (context: string, target?: LineRange) => ChatMessage[],
    previous?: WalkthroughView,
  ): Promise<ExplainResult> {
    const key = SessionStore.key(document.uri);
    // Snapshot the text now; later edits do not change what is sent.
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const info = pathInfo(document.uri);
    const displayPath = info.relPath ?? displayName(document);
    const { style, maxLines } = this.deps.settings(document.uri);
    const focus = options.target && clampRange(options.target, lines.length);
    // A selection or symbol is sent with a budgeted window of the file around it (arch §5.3).
    const window = focus
      ? contextWindow(
          lines,
          focus,
          CONTEXT_BUDGET_CHARS,
          maxLines,
          await this.deps.enclosingSymbol(document, focus),
        )
      : { start: 1, end: lines.length };
    const windowLines = focus ? lines.slice(window.start - 1, window.end) : lines;
    const cancel = new vscode.CancellationTokenSource();

    let outcome: GateOutcome;
    try {
      outcome = await this.gate.send(
        {
          target: {
            ...info,
            fileName: displayName(document),
            languageId: document.languageId,
            lines: windowLines,
            byteLength: focus
              ? Buffer.byteLength(windowLines.join('\n'), 'utf8')
              : Buffer.byteLength(text, 'utf8'),
            firstLine: window.start,
          },
          secretsAction: options.secretsAction,
          provider: options.provider,
          build: (prepared) => ({
            system: walkthroughSystem(style),
            messages: messages(
              focus
                ? buildWindowContext({
                    path: displayPath,
                    languageId: document.languageId,
                    lines: prepared.lines,
                    withheld: prepared.withheld,
                    firstLine: window.start,
                    lineCount: lines.length,
                    target: focus,
                  })
                : buildFileContext({
                    path: displayPath,
                    languageId: document.languageId,
                    lines: prepared.lines,
                    withheld: prepared.withheld,
                  }),
              focus,
            ),
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

    const target: LineRange = focus ?? { start: 1, end: lines.length };
    const parser = new ProtocolParser(previous ? 'continuation' : 'response');
    let wid: string;
    if (previous) {
      wid = previous.id;
      this.session.update(key, wid, (entry) => {
        entry.cancel = cancel;
        entry.view.status = 'streaming';
        entry.view.error = null;
      });
    } else {
      const view = newView(document, outcome, focus ?? null, style);
      wid = view.id;
      this.session.set(key, { view, cancel, raw: '', focus: null, opened: null, showAll: false });
    }
    // Continued steps are appended after the ones already shown.
    const stepOffset = previous?.steps.length ?? 0;
    const apply = (events: ProtocolEvent[]): void => {
      for (const e of events) {
        this.applyEvent(key, wid, e, target, stepOffset);
      }
    };

    const started = Date.now();
    const finish = (status: WalkthroughView['status'], error: string | null = null): void => {
      this.session.update(key, wid, (entry) => {
        const view = entry.view;
        view.status = status;
        view.error = error;
        view.durationMs = Date.now() - started;
        entry.cancel = undefined;
        settle(view, parser.structured || Boolean(previous), entry.raw);
        if (entry.focus !== null && entry.focus >= view.steps.length) {
          entry.focus = null;
        }
        if (entry.opened !== null && entry.opened >= view.steps.length) {
          entry.opened = null;
        }
      });
      cancel.dispose();
      this.log.info(`explain: ${status} after ${Date.now() - started} ms`);
      this.log.debugContent('response', this.session.get(key)?.raw ?? '');
    };

    try {
      for await (const chunk of outcome.stream) {
        if (chunk.type === 'done') {
          const usage = chunk.usage;
          if (usage) {
            this.session.stream(key, wid, ({ view }) => (view.usage = usage));
          }
          continue;
        }
        const wasStructured = parser.structured;
        this.session.stream(key, wid, (entry) => {
          entry.raw += chunk.text;
        });
        apply(parser.push(chunk.text));
        this.showUnstructured(key, wid, parser, wasStructured, Boolean(previous));
      }
      apply(parser.finish());
      if (cancel.token.isCancellationRequested) {
        finish('stopped');
        return { kind: 'stopped', wid };
      }
      if ((parser.structured || previous) && !parser.ended) {
        finish('truncated');
        return { kind: 'truncated', wid };
      }
      finish('done');
      return { kind: 'done', wid };
    } catch (err) {
      apply(parser.finish());
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
      return {
        kind: 'failed',
        wid,
        message,
        category: err instanceof ProviderError ? err.category : undefined,
      };
    }
  }

  private applyEvent(
    key: string,
    wid: string,
    e: ProtocolEvent,
    target: LineRange,
    offset: number,
  ): void {
    switch (e.type) {
      case 'overviewDelta':
        this.session.stream(key, wid, ({ view }) => {
          view.overview += e.text;
        });
        return;
      case 'stepStart':
        this.session.update(key, wid, ({ view }) => {
          const { ranges, anchored } = anchorRanges(e.ranges, target);
          view.steps.push({
            index: view.steps.length,
            title: e.title,
            ranges,
            text: '',
            concepts: [],
            anchored,
          });
        });
        return;
      case 'stepDelta':
        this.session.stream(key, wid, ({ view }) => {
          const step = view.steps[e.index + offset];
          if (step) {
            step.text += e.text;
          }
        });
        return;
      case 'concepts':
        this.session.stream(key, wid, ({ view }) => {
          const step = view.steps[e.index + offset];
          if (step) {
            step.concepts = e.concepts;
          }
        });
        return;
      case 'summaryDelta':
        this.session.stream(key, wid, ({ view }) => {
          view.summary += e.text;
        });
        return;
      case 'watchDelta':
        this.session.stream(key, wid, ({ view }) => {
          view.watch += e.text;
        });
        return;
      case 'end':
        return;
    }
  }

  /** Until the first tag, the raw text streams as plain Markdown so the user sees progress. */
  private showUnstructured(
    key: string,
    wid: string,
    parser: ProtocolParser,
    wasStructured: boolean,
    continuing: boolean,
  ): void {
    if (continuing) {
      return;
    }
    if (!parser.structured) {
      this.session.stream(key, wid, (entry) => {
        entry.view.fallbackMarkdown = entry.raw;
      });
    } else if (!wasStructured) {
      this.session.update(key, wid, ({ view }) => {
        view.fallbackMarkdown = null;
      });
    }
  }
}

/** Final validation (spec §10): drop empty steps, fall back to Markdown when unusable. */
function settle(view: WalkthroughView, structured: boolean, raw: string): void {
  if (!structured) {
    view.fallbackMarkdown = raw;
    view.notice = raw.trim() ? NOT_STRUCTURED_NOTICE : null;
    return;
  }
  view.fallbackMarkdown = null;
  view.steps = view.steps
    .filter((s) => s.title.trim() && s.text.trim())
    .map((s, index): StepView => ({ ...s, index }));
  const unanchored = view.steps.filter((s) => !s.anchored).length;
  if (view.steps.length > 0 && unanchored * 2 > view.steps.length) {
    view.fallbackMarkdown = asMarkdown(view);
    view.notice = UNANCHORED_NOTICE;
  }
}

function asMarkdown(view: WalkthroughView): string {
  const parts = [view.overview.trim()];
  for (const s of view.steps) {
    parts.push(`#### ${s.index + 1}. ${s.title}`, s.text.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}

function newView(
  document: vscode.TextDocument,
  outcome: Extract<GateOutcome, { kind: 'sent' }>,
  target: LineRange | null,
  style: ExplanationStyle,
): WalkthroughView {
  return {
    target,
    style,
    id: newId(),
    fileName: displayName(document),
    providerLabel: outcome.providerLabel,
    model: outcome.model,
    status: 'streaming',
    overview: '',
    steps: [],
    summary: '',
    watch: '',
    fallbackMarkdown: null,
    notice: null,
    error: null,
    durationMs: null,
    withheld: outcome.withheld,
    stale: false,
  };
}

function clampRange(range: LineRange, lineCount: number): LineRange {
  const start = Math.min(Math.max(1, range.start), lineCount);
  return { start, end: Math.min(Math.max(start, range.end), lineCount) };
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
