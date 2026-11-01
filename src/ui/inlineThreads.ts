// Inline explanations in the editor (arch §6, ADR-0028): each walkthrough is read-only comment
// threads in its document. The overview thread sits at line 1; each anchored step gets a thread
// just above its first line, expanded only when focused (or with Show all).
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import { canContinue, type StepView, type WalkthroughView } from '../state/types';
import { safeMarkdown } from './safeMarkdown';

export const CONTROLLER_ID = 'logiclens';
export const ASK_CONCEPT_COMMAND = 'logiclens.askConcept';
/** About ten body updates per second while streaming (arch §6). */
const DELTA_FLUSH_MS = 100;

/** What a thread shows; integration tests read it through the `TestApi`. */
export interface ThreadSnapshot {
  /** 0-based line the thread is attached to. */
  line: number;
  label: string;
  contextValue: string;
  authors: string[];
  commentLabel: string;
  body: string;
  expanded: boolean;
}

interface Rendered {
  thread: vscode.CommentThread;
  /** Last rendered content and expansion, so unchanged threads are left alone. */
  signature: string;
  expanded: boolean | undefined;
}

interface DocThreads {
  wid: string;
  overview: Rendered;
  /** By step index; only anchored steps have a thread. */
  steps: Map<number, Rendered>;
}

export class InlineThreads implements vscode.Disposable {
  private readonly docs = new Map<string, DocThreads>();
  private readonly dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly subscriptions: vscode.Disposable[];

  /** The controller is shared with question threads (S4), which own its commenting ranges. */
  constructor(
    private readonly session: SessionStore,
    private readonly controller: vscode.CommentController,
  ) {
    this.subscriptions = [
      session.onDidChange((key) => this.render(key)),
      session.onDelta(({ key }) => this.queue(key)),
    ];
  }

  snapshot(uri: vscode.Uri): ThreadSnapshot | undefined {
    const doc = this.docs.get(SessionStore.key(uri));
    return doc && snap(doc.overview.thread);
  }

  stepSnapshots(uri: vscode.Uri): (ThreadSnapshot & { index: number })[] {
    const doc = this.docs.get(SessionStore.key(uri));
    if (!doc) {
      return [];
    }
    return [...doc.steps.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([index, r]) => {
        const s = snap(r.thread);
        return s ? [{ ...s, index }] : [];
      });
  }

  /** The step a step thread belongs to, for its title actions. */
  stepIndexOf(thread: vscode.CommentThread): number | undefined {
    for (const doc of this.docs.values()) {
      for (const [index, r] of doc.steps) {
        if (r.thread === thread) {
          return index;
        }
      }
    }
    return undefined;
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
    const entry = this.session.get(key);
    let doc = this.docs.get(key);
    if (!entry || doc?.wid !== entry.view.id) {
      if (doc) {
        disposeDoc(doc);
        this.docs.delete(key);
      }
      if (!entry) {
        return;
      }
      doc = this.createDoc(vscode.Uri.parse(key, true), entry.view.id);
      this.docs.set(key, doc);
    }
    const { view } = entry;

    update(doc.overview, {
      label: overviewLabel(view),
      contextValue: overviewContext(view),
      comments: overviewComments(view, key),
      expanded: undefined,
    });

    const uri = doc.overview.thread.uri;
    const wanted = new Set<number>();
    // A Markdown fallback is shown whole in the overview thread, without step threads.
    const steps = view.fallbackMarkdown === null ? view.steps : [];
    for (const step of steps) {
      const first = step.anchored ? step.ranges[0] : undefined;
      if (!first) {
        continue;
      }
      wanted.add(step.index);
      let rendered = doc.steps.get(step.index);
      const line = stepLine(first.start);
      if (rendered && rendered.thread.range.start.line !== line) {
        rendered.thread.dispose();
        rendered = undefined;
      }
      if (!rendered) {
        rendered = this.createStep(uri, line);
        doc.steps.set(step.index, rendered);
      }
      update(rendered, {
        label: `${step.index + 1} · ${step.title}`,
        contextValue: 'step',
        comments: [stepComment(step, key)],
        expanded: entry.showAll || entry.opened === step.index,
      });
    }
    for (const [index, rendered] of doc.steps) {
      if (!wanted.has(index)) {
        rendered.thread.dispose();
        doc.steps.delete(index);
      }
    }
  }

  private createDoc(uri: vscode.Uri, wid: string): DocThreads {
    const top = new vscode.Range(0, 0, 0, 0);
    const thread = this.controller.createCommentThread(uri, top, []);
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    // The overview starts at the top of the file, so bring it into view.
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri.toString()) {
        editor.revealRange(top, vscode.TextEditorRevealType.AtTop);
      }
    }
    return { wid, overview: { thread, signature: '', expanded: true }, steps: new Map() };
  }

  private createStep(uri: vscode.Uri, line: number): Rendered {
    const thread = this.controller.createCommentThread(uri, new vscode.Range(line, 0, line, 0), []);
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    return { thread, signature: '', expanded: false };
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    for (const s of this.subscriptions) {
      s.dispose();
    }
    for (const doc of this.docs.values()) {
      disposeDoc(doc);
    }
    this.docs.clear();
  }
}

/**
 * Comment threads show below the line they are attached to, so a step's thread is attached to
 * the line before its first line and appears just above its code. A step starting at line 1
 * shows below line 1.
 */
export function stepLine(firstLine: number): number {
  return Math.max(0, firstLine - 2);
}

interface Content {
  label: string;
  contextValue: string;
  comments: vscode.Comment[];
  /** Undefined leaves the user's own expand or collapse alone. */
  expanded: boolean | undefined;
}

function update(rendered: Rendered, content: Content): void {
  const { thread } = rendered;
  const signature = JSON.stringify([
    content.label,
    content.contextValue,
    content.comments.map((c) => [c.author.name, c.label, (c.body as vscode.MarkdownString).value]),
  ]);
  if (signature !== rendered.signature) {
    rendered.signature = signature;
    thread.label = content.label;
    thread.contextValue = content.contextValue;
    thread.comments = content.comments;
  }
  // Set only on change, so a thread the user opened or closed by hand stays that way.
  if (content.expanded !== undefined && content.expanded !== rendered.expanded) {
    rendered.expanded = content.expanded;
    thread.collapsibleState = content.expanded
      ? vscode.CommentThreadCollapsibleState.Expanded
      : vscode.CommentThreadCollapsibleState.Collapsed;
  }
}

function overviewLabel(view: WalkthroughView): string {
  const stale = view.stale ? ' (file changed since)' : '';
  switch (view.status) {
    case 'streaming':
      return `Explaining ${view.fileName}…`;
    case 'stopped':
      return `${view.fileName}: stopped${stale}`;
    case 'failed':
      return `${view.fileName}: failed${stale}`;
    case 'truncated':
      return `${view.fileName}: incomplete${stale}`;
    default:
      return `${view.fileName}${stale}`;
  }
}

/** Drives the thread title menus in package.json. */
function overviewContext(view: WalkthroughView): string {
  if (view.status === 'streaming') {
    return 'streaming';
  }
  return canContinue(view) && !view.stale ? 'continuable' : 'finished';
}

function overviewComments(view: WalkthroughView, key: string): vscode.Comment[] {
  const comments: vscode.Comment[] = [
    comment(
      `LogicLens · ${view.providerLabel} · ${view.model}`,
      duration(view),
      overviewBody(view, key),
    ),
  ];
  const summary = summaryBody(view);
  if (summary) {
    comments.push(comment('Summary', '', summary));
  }
  return comments;
}

function overviewBody(view: WalkthroughView, key: string): string {
  const parts: string[] = [];
  if (view.withheld.length > 0) {
    const n = view.withheld.length;
    const where = view.withheld.map((l) => `L${l}`).join(', ');
    parts.push(
      `> ${n} ${n === 1 ? 'line' : 'lines'} withheld: ${n === 1 ? 'possible secret' : 'possible secrets'} on ${where}`,
    );
  }
  if (view.notice) {
    parts.push(`> ${view.notice}`);
  }
  if (view.fallbackMarkdown !== null) {
    parts.push(safeMarkdown(view.fallbackMarkdown));
  } else {
    parts.push(safeMarkdown(view.overview.trim()));
    const shown = view.steps.filter((s) => s.anchored);
    if (shown.length > 0) {
      parts.push(
        `*${shown.length} ${shown.length === 1 ? 'step' : 'steps'} in the code below. Alt+] goes to the next one.*`,
      );
    }
    for (const step of view.steps.filter((s) => !s.anchored)) {
      parts.push(`**${step.index + 1} · ${safeMarkdown(step.title)}** (not linked to lines)`);
      parts.push(stepBody(step, key));
    }
  }
  if (parts.every((p) => !p.trim()) && view.status === 'streaming') {
    parts.push('*Waiting for the model…*');
  }
  if (view.status === 'stopped') {
    parts.push('*Stopped. The explanation above is partial.*');
  } else if (view.status === 'truncated') {
    parts.push('*The response ended early. Continue asks for the remaining steps.*');
  } else if (view.status === 'failed' && view.error) {
    parts.push(`**${view.error}**`);
  }
  return parts.filter((p) => p.trim()).join('\n\n');
}

function summaryBody(view: WalkthroughView): string {
  if (view.fallbackMarkdown !== null) {
    return '';
  }
  const parts: string[] = [];
  if (view.summary.trim()) {
    parts.push(safeMarkdown(view.summary.trim()));
  }
  if (view.watch.trim()) {
    parts.push(`**Things to watch**\n\n${safeMarkdown(view.watch.trim())}`);
  }
  return parts.join('\n\n');
}

function stepComment(step: StepView, key: string): vscode.Comment {
  return comment('LogicLens', rangesLabel(step), stepBody(step, key) || '*…*');
}

/** Concept tags link to Ask with the question pre-filled (S4); the link carries indexes only. */
function stepBody(step: StepView, key: string): string {
  const parts = [safeMarkdown(step.text.trim())];
  if (step.concepts.length > 0) {
    parts.push(
      step.concepts
        .map((c, i) => {
          const args = encodeURIComponent(JSON.stringify([key, step.index, i]));
          const text = c.replace(/[`[\]()\\]/g, '');
          return `[\`${text}\`](command:${ASK_CONCEPT_COMMAND}?${args} "Ask about ${text.replace(/"/g, '')}")`;
        })
        .join(' · '),
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

export function rangesLabel(step: StepView): string {
  return step.ranges
    .map((r) => (r.start === r.end ? `L${r.start}` : `L${r.start}–${r.end}`))
    .join(', ');
}

function comment(author: string, label: string, markdown: string): vscode.Comment {
  // Untrusted model output: no HTML, no theme icons, and no command links except the concept
  // tags' own Ask command; safeMarkdown already removed every non-http link (arch §8).
  const body = new vscode.MarkdownString(markdown);
  body.isTrusted = { enabledCommands: [ASK_CONCEPT_COMMAND] };
  body.supportHtml = false;
  body.supportThemeIcons = false;
  return { author: { name: author }, label, body, mode: vscode.CommentMode.Preview };
}

/** Duration and, when reported, token counts (spec §6). Never a price. */
function duration(view: WalkthroughView): string {
  const parts = view.durationMs === null ? [] : [`${(view.durationMs / 1000).toFixed(1)}s`];
  const { inputTokens, outputTokens } = view.usage ?? {};
  if (inputTokens !== undefined && outputTokens !== undefined) {
    const n = (x: number): string => x.toLocaleString('en-US');
    parts.push(`${n(inputTokens)} in / ${n(outputTokens)} out tokens`);
  }
  return parts.join(' · ');
}

function snap(thread: vscode.CommentThread): ThreadSnapshot | undefined {
  const first = thread.comments[0];
  if (!first) {
    return undefined;
  }
  const text = (c: vscode.Comment): string => (typeof c.body === 'string' ? c.body : c.body.value);
  return {
    line: thread.range.start.line,
    label: thread.label ?? '',
    contextValue: thread.contextValue ?? '',
    authors: thread.comments.map((c) => c.author.name),
    commentLabel: first.label ?? '',
    body: thread.comments.map(text).join('\n\n---\n\n'),
    expanded: thread.collapsibleState === vscode.CommentThreadCollapsibleState.Expanded,
  };
}

function disposeDoc(doc: DocThreads): void {
  doc.overview.thread.dispose();
  for (const r of doc.steps.values()) {
    r.thread.dispose();
  }
}
