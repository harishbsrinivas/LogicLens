// Inline explanations in the editor (arch §6, ADR-0028): each walkthrough is a read-only comment
// thread anchored in its document. S1: one thread at the top of the file with the Markdown.
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import type { WalkthroughView } from '../state/types';
import { safeMarkdown } from './safeMarkdown';

export const CONTROLLER_ID = 'logiclens';
/** About ten body updates per second while streaming (arch §6). */
const DELTA_FLUSH_MS = 100;

/** What a thread shows; integration tests read it through the `TestApi`. */
export interface ThreadSnapshot {
  label: string;
  contextValue: string;
  author: string;
  commentLabel: string;
  body: string;
  expanded: boolean;
}

interface Rendered {
  wid: string;
  thread: vscode.CommentThread;
}

export class InlineThreads implements vscode.Disposable {
  private readonly controller = vscode.comments.createCommentController(CONTROLLER_ID, 'LogicLens');
  private readonly threads = new Map<string, Rendered>();
  private readonly dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly session: SessionStore) {
    // No commenting ranges yet: questions at any line arrive in S4 (ADR-0008).
    this.subscriptions = [
      session.onDidChange((key) => this.render(key)),
      session.onDelta(({ key }) => this.queue(key)),
    ];
  }

  snapshot(uri: vscode.Uri): ThreadSnapshot | undefined {
    const thread = this.threads.get(SessionStore.key(uri))?.thread;
    const comment = thread?.comments[0];
    if (!thread || !comment) {
      return undefined;
    }
    return {
      label: thread.label ?? '',
      contextValue: thread.contextValue ?? '',
      author: comment.author.name,
      commentLabel: comment.label ?? '',
      body: typeof comment.body === 'string' ? comment.body : comment.body.value,
      expanded: thread.collapsibleState === vscode.CommentThreadCollapsibleState.Expanded,
    };
  }

  private queue(key: string): void {
    this.dirty.add(key);
    this.flushTimer ??= setTimeout(() => this.flush(), DELTA_FLUSH_MS);
  }

  private flush(): void {
    this.flushTimer = undefined;
    const keys = [...this.dirty];
    this.dirty.clear();
    for (const key of keys) {
      this.render(key);
    }
  }

  private render(key: string): void {
    this.dirty.delete(key);
    const view = this.session.get(key)?.view;
    const current = this.threads.get(key);
    if (!view) {
      current?.thread.dispose();
      this.threads.delete(key);
      return;
    }
    let thread = current?.wid === view.id ? current.thread : undefined;
    if (!thread) {
      current?.thread.dispose();
      thread = this.create(vscode.Uri.parse(key, true));
      this.threads.set(key, { wid: view.id, thread });
    }
    thread.label = threadLabel(view);
    thread.contextValue = view.status === 'streaming' ? 'streaming' : 'finished';
    thread.comments = [
      {
        author: { name: `LogicLens · ${view.providerLabel} · ${view.model}` },
        label: commentLabel(view),
        body: body(view),
        mode: vscode.CommentMode.Preview,
      },
    ];
  }

  private create(uri: vscode.Uri): vscode.CommentThread {
    const top = new vscode.Range(0, 0, 0, 0);
    const thread = this.controller.createCommentThread(uri, top, []);
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    // The explanation starts at the top of the file, so bring it into view.
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri.toString()) {
        editor.revealRange(top, vscode.TextEditorRevealType.AtTop);
      }
    }
    return thread;
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.controller.dispose();
    this.threads.clear();
  }
}

function threadLabel(view: WalkthroughView): string {
  switch (view.status) {
    case 'streaming':
      return `Explaining ${view.fileName}…`;
    case 'stopped':
      return `${view.fileName}: stopped`;
    case 'failed':
      return `${view.fileName}: failed`;
    default:
      return view.fileName;
  }
}

function commentLabel(view: WalkthroughView): string {
  return view.durationMs === null ? '' : `${(view.durationMs / 1000).toFixed(1)}s`;
}

function body(view: WalkthroughView): vscode.MarkdownString {
  const parts: string[] = [];
  if (view.withheld.length > 0) {
    const n = view.withheld.length;
    const where = view.withheld.map((l) => `L${l}`).join(', ');
    parts.push(
      `> ${n} ${n === 1 ? 'line' : 'lines'} withheld: ${n === 1 ? 'possible secret' : 'possible secrets'} on ${where}`,
    );
  }
  const text = safeMarkdown(view.fallbackMarkdown ?? '');
  parts.push(text || (view.status === 'streaming' ? '*Waiting for the model…*' : ''));
  if (view.status === 'stopped') {
    parts.push('*Stopped. The explanation above is partial.*');
  } else if (view.status === 'failed' && view.error) {
    parts.push(`**${view.error}**`);
  }
  // Untrusted model output: no command links, no HTML, no theme icons (arch §8).
  const md = new vscode.MarkdownString(parts.filter(Boolean).join('\n\n'));
  md.isTrusted = false;
  md.supportHtml = false;
  md.supportThemeIcons = false;
  return md;
}
