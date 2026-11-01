// Question threads (arch §6, ADR-0008, spec §5): the gutter "+" on every eligible line, the
// user's questions as "You" comments, and streamed answers. Shares the comment controller with
// the inline explanations; renders state from `QuestionStore`.
import * as vscode from 'vscode';
import type { QuestionStore, QuestionThread, Turn } from '../state/questions';
import { shiftRange } from '../state/rangeShift';
import type { LineRange } from '../state/types';
import { linkifyLines, REVEAL_LINE_COMMAND } from './lineLinks';
import { safeMarkdown } from './safeMarkdown';

const DELTA_FLUSH_MS = 100;

/** Comments carry the ids their menu commands need; VS Code passes the same object back. */
export interface QuestionComment extends vscode.Comment {
  threadId: string;
  turnId: string;
  part: 'question' | 'answer';
}

export interface QuestionSnapshot {
  id: string;
  line: number;
  label: string;
  contextValue: string;
  collapsed: boolean;
  comments: { author: string; body: string; contextValue: string }[];
}

interface Rendered {
  thread: vscode.CommentThread;
  signature: string;
  changed: boolean;
}

export class QuestionThreads implements vscode.Disposable {
  private readonly rendered = new Map<string, Rendered>();
  /** Threads opened but not asked yet (gutter "+", Ask commands), with what they are about. */
  private readonly pending = new Map<vscode.CommentThread, LineRange>();
  private readonly dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscriptions: vscode.Disposable[];

  constructor(
    private readonly controller: vscode.CommentController,
    private readonly store: QuestionStore,
    private readonly isBusy: (threadId: string) => boolean,
  ) {
    this.subscriptions = [
      store.onDidChange((id) => this.render(id)),
      store.onDelta((id) => this.queue(id)),
      vscode.workspace.onDidChangeTextDocument((e) => this.track(e)),
    ];
  }

  /** Moves threads with edits above them; marks them changed when their lines go (spec §5). */
  private track(e: vscode.TextDocumentChangeEvent): void {
    const threads = this.store.inDocument(e.document.uri.toString());
    if (threads.length === 0 || e.contentChanges.length === 0) {
      return;
    }
    // Changes do not overlap and refer to the old document; apply bottom-up.
    const edits = [...e.contentChanges]
      .sort((a, b) => b.range.start.compareTo(a.range.start))
      .map((c) => ({
        startLine: c.range.start.line,
        startCharacter: c.range.start.character,
        endLine: c.range.end.line,
        endCharacter: c.range.end.character,
        text: c.text,
      }));
    for (const thread of threads) {
      let range = thread.range;
      let deleted = false;
      for (const edit of edits) {
        const shifted = shiftRange(range, edit);
        range = shifted.range;
        deleted ||= shifted.deleted;
      }
      if (deleted || range.start !== thread.range.start || range.end !== thread.range.end) {
        this.store.update(thread.id, (t) => {
          t.range = range;
          t.changed ||= deleted;
        });
      }
    }
  }

  /** Opens an empty thread with the reply box focused, for a question about `target`. */
  open(uri: vscode.Uri, target: LineRange, at: LineRange = target): vscode.CommentThread {
    const thread = this.controller.createCommentThread(
      uri,
      new vscode.Range(at.start - 1, 0, at.end - 1, 0),
      [],
    );
    thread.canReply = true;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.contextValue = 'question-new';
    this.pending.set(thread, target);
    return thread;
  }

  /** The state id for a thread, creating state for one opened by the gutter "+". */
  adopt(thread: vscode.CommentThread, key: string): string {
    const known = this.idOf(thread);
    if (known) {
      return known;
    }
    const range = this.pending.get(thread) ?? {
      start: thread.range.start.line + 1,
      end: thread.range.end.line + 1,
    };
    this.pending.delete(thread);
    const state = this.store.create(key, range);
    // Register before the store's change event renders, so no second thread is created.
    this.rendered.set(state.id, { thread, signature: '', changed: false });
    this.render(state.id);
    return state.id;
  }

  idOf(thread: vscode.CommentThread): string | undefined {
    for (const [id, r] of this.rendered) {
      if (r.thread === thread) {
        return id;
      }
    }
    return undefined;
  }

  /** Empty threads opened by commands that were never asked. */
  pendingThreads(uri: vscode.Uri): vscode.CommentThread[] {
    return [...this.pending.keys()].filter((t) => t.uri.toString() === uri.toString());
  }

  discardPending(uri?: vscode.Uri): void {
    for (const thread of [...this.pending.keys()]) {
      if (!uri || thread.uri.toString() === uri.toString()) {
        this.pending.delete(thread);
        thread.dispose();
      }
    }
  }

  snapshots(uri: vscode.Uri): QuestionSnapshot[] {
    return [...this.rendered.entries()]
      .filter(([, r]) => r.thread.uri.toString() === uri.toString())
      .map(([id, r]) => ({
        id,
        line: r.thread.range.start.line,
        label: r.thread.label ?? '',
        contextValue: r.thread.contextValue ?? '',
        collapsed: r.thread.collapsibleState === vscode.CommentThreadCollapsibleState.Collapsed,
        comments: r.thread.comments.map((c) => ({
          author: c.author.name,
          body: typeof c.body === 'string' ? c.body : c.body.value,
          contextValue: c.contextValue ?? '',
        })),
      }));
  }

  /** The comment objects of a thread, for tests that run comment menu commands. */
  comments(threadId: string): readonly vscode.Comment[] {
    return this.rendered.get(threadId)?.thread.comments ?? [];
  }

  private queue(id: string): void {
    this.dirty.add(id);
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = undefined;
      const ids = [...this.dirty];
      this.dirty.clear();
      ids.forEach((i) => this.render(i));
    }, DELTA_FLUSH_MS);
  }

  private render(id: string): void {
    this.dirty.delete(id);
    const state = this.store.get(id);
    let rendered = this.rendered.get(id);
    if (!state) {
      rendered?.thread.dispose();
      this.rendered.delete(id);
      return;
    }
    if (!rendered) {
      const thread = this.controller.createCommentThread(
        vscode.Uri.parse(state.key, true),
        toRange(state.range),
        [],
      );
      thread.canReply = true;
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      rendered = { thread, signature: '', changed: false };
      this.rendered.set(id, rendered);
    }
    const { thread } = rendered;
    const busy = this.isBusy(id);
    const range = toRange(state.range);
    if (!thread.range.isEqual(range)) {
      thread.range = range;
    }
    const comments = state.turns.flatMap((turn) => turnComments(state, turn));
    const label = state.changed ? 'Code changed' : '';
    const contextValue = busy ? 'question-busy' : 'question';
    const signature = JSON.stringify([
      label,
      contextValue,
      comments.map((c) => [c.author.name, c.contextValue, (c.body as vscode.MarkdownString).value]),
    ]);
    if (signature === rendered.signature) {
      return;
    }
    // Collapse once when the code goes away; later the user's own expand stays.
    const becameChanged = state.changed && !rendered.changed;
    rendered.changed = state.changed;
    rendered.signature = signature;
    thread.label = label || undefined;
    thread.contextValue = contextValue;
    thread.comments = comments;
    if (becameChanged) {
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    }
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.discardPending();
    for (const r of this.rendered.values()) {
      r.thread.dispose();
    }
    this.rendered.clear();
  }
}

function toRange(r: LineRange): vscode.Range {
  return new vscode.Range(r.start - 1, 0, r.end - 1, 0);
}

function turnComments(state: QuestionThread, turn: Turn): QuestionComment[] {
  const question = new vscode.MarkdownString(safeMarkdown(turn.question));
  untrusted(question);
  const out: QuestionComment[] = [
    {
      threadId: state.id,
      turnId: turn.id,
      part: 'question',
      author: { name: 'You' },
      body: question,
      mode: vscode.CommentMode.Preview,
      contextValue: 'question',
    },
  ];
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === state.key);
  const lineCount = doc?.lineCount ?? 0;
  const parts: string[] = [];
  if (turn.answer.trim()) {
    parts.push(linkifyLines(safeMarkdown(turn.answer.trim()), state.key, lineCount));
  }
  switch (turn.status) {
    case 'queued':
      parts.push('*Waiting…*');
      break;
    case 'streaming':
      if (!turn.answer.trim()) {
        parts.push('*Waiting for the model…*');
      }
      break;
    case 'stopped':
      parts.push('*Stopped.*');
      break;
    case 'failed':
      parts.push(`**${turn.error ?? 'The answer failed.'}**`);
      break;
    default:
      break;
  }
  // Model output: HTML and icons off; only the line links' own command is enabled (arch §8).
  const answer = new vscode.MarkdownString(parts.join('\n\n'));
  answer.isTrusted = { enabledCommands: [REVEAL_LINE_COMMAND] };
  answer.supportHtml = false;
  answer.supportThemeIcons = false;
  const who = turn.providerLabel ? `LogicLens · ${turn.providerLabel}/${turn.model}` : 'LogicLens';
  out.push({
    threadId: state.id,
    turnId: turn.id,
    part: 'answer',
    author: { name: who },
    body: answer,
    mode: vscode.CommentMode.Preview,
    contextValue:
      turn.status === 'queued' || turn.status === 'streaming' ? 'answer-busy' : 'answer',
  });
  return out;
}

function untrusted(md: vscode.MarkdownString): void {
  md.isTrusted = false;
  md.supportHtml = false;
  md.supportThemeIcons = false;
}

export function isQuestionComment(arg: unknown): arg is QuestionComment {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'threadId' in arg &&
    typeof arg.threadId === 'string' &&
    'turnId' in arg &&
    typeof arg.turnId === 'string'
  );
}

/** The gutter "+" on every line of documents a question could be sent from (arch §6). */
export function commentingRanges(
  eligible: (document: vscode.TextDocument) => Promise<boolean>,
): vscode.CommentingRangeProvider {
  return {
    async provideCommentingRanges(document) {
      if (!['file', 'untitled'].includes(document.uri.scheme) || !(await eligible(document))) {
        return [];
      }
      return [new vscode.Range(0, 0, Math.max(0, document.lineCount - 1), 0)];
    },
  };
}
