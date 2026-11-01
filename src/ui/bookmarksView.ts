// Bookmarks view (arch §6, spec §14): a TreeView grouped by file, a gutter icon on bookmarked
// lines, and a read-only "Bookmarked explanation" thread when a bookmark is opened.
import * as vscode from 'vscode';
import { bookmarkLabel, type Bookmark, type BookmarkStore } from '../bookmarks/store';
import { safeMarkdown } from './safeMarkdown';

export type BookmarkNode = { kind: 'file'; uri: string } | { kind: 'bookmark'; id: string };

const KIND_ICON: Record<Bookmark['kind'], string> = {
  step: 'list-ordered',
  answer: 'comment',
  code: 'code',
};

export class BookmarksTree implements vscode.TreeDataProvider<BookmarkNode>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<BookmarkNode | undefined>();
  private readonly subscription: { dispose(): void };
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly store: BookmarkStore) {
    this.subscription = store.onDidChange(() => {
      void vscode.commands.executeCommand(
        'setContext',
        'logiclens.hasBookmarks',
        store.list().length > 0,
      );
      this.changed.fire(undefined);
    });
  }

  getChildren(node?: BookmarkNode): BookmarkNode[] {
    const all = this.store.list();
    if (!node) {
      return [...new Set(all.map((b) => b.uri))]
        .sort((a, b) => fileName(a).localeCompare(fileName(b)))
        .map((uri) => ({ kind: 'file', uri }));
    }
    if (node.kind === 'file') {
      return all
        .filter((b) => b.uri === node.uri)
        .sort((a, b) => (a.ranges[0]?.start ?? 0) - (b.ranges[0]?.start ?? 0))
        .map((b) => ({ kind: 'bookmark', id: b.id }));
    }
    return [];
  }

  getTreeItem(node: BookmarkNode): vscode.TreeItem {
    if (node.kind === 'file') {
      const uri = vscode.Uri.parse(node.uri, true);
      const item = new vscode.TreeItem(uri, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'bookmarkFile';
      return item;
    }
    const b = this.store.get(node.id);
    const item = new vscode.TreeItem(b ? bookmarkLabel(b) : '(removed)');
    if (b) {
      item.description = `${b.ranges.map(rangeLabel).join(', ')}${b.changed ? ' · code changed' : ''}`;
      item.iconPath = new vscode.ThemeIcon(b.changed ? 'warning' : KIND_ICON[b.kind]);
      item.tooltip = `${b.kind === 'code' ? 'Code' : b.kind === 'step' ? 'Step' : 'Answer'} bookmark, ${new Date(b.createdAt).toLocaleString()}`;
      item.command = {
        command: 'logiclens.showBookmark',
        title: 'Show Bookmark',
        arguments: [b.id],
      };
      item.contextValue = 'bookmark';
      item.id = b.id;
    }
    return item;
  }

  dispose(): void {
    this.subscription.dispose();
    this.changed.dispose();
  }
}

function bookmarkIcon(color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="${color}" d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

/**
 * Gutter icons on bookmarked lines and the highlight of the opened bookmark. Gutter icons do not
 * stack; lines that already show a step number or lock are skipped (arch §6 precedence).
 */
export class BookmarkDecorations implements vscode.Disposable {
  private readonly gutter = vscode.window.createTextEditorDecorationType({
    light: { gutterIconPath: bookmarkIcon('#6c6c6c') },
    dark: { gutterIconPath: bookmarkIcon('#a0a0a0') },
    gutterIconSize: '75%',
  });
  private readonly highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    isWholeLine: true,
    borderWidth: '0 0 0 2px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('focusBorder'),
  });
  private shown: string | undefined;
  private readonly subscriptions: { dispose(): void }[];

  constructor(
    private readonly store: BookmarkStore,
    private readonly taken: (uri: vscode.Uri) => readonly number[],
  ) {
    this.subscriptions = [
      store.onDidChange(() => this.apply()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.apply()),
    ];
  }

  show(id: string | undefined): void {
    this.shown = id;
    this.apply();
  }

  apply(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const key = editor.document.uri.toString();
      const marks = this.store.inDocument(key);
      const busy = new Set(this.taken(editor.document.uri));
      const lines = [...new Set(marks.flatMap((b) => b.ranges.map((r) => r.start)))].filter(
        (l) => !busy.has(l) && l <= editor.document.lineCount,
      );
      editor.setDecorations(
        this.gutter,
        lines.map((l) => ({
          range: new vscode.Range(l - 1, 0, l - 1, 0),
          hoverMessage: 'Bookmarked in LogicLens',
        })),
      );
      const shown = marks.find((b) => b.id === this.shown);
      editor.setDecorations(
        this.highlight,
        (shown?.ranges ?? []).map((r) => new vscode.Range(r.start - 1, 0, r.end - 1, 0)),
      );
    }
  }

  dispose(): void {
    this.gutter.dispose();
    this.highlight.dispose();
    this.subscriptions.forEach((s) => s.dispose());
  }
}

/** Read-only "Bookmarked explanation" threads on the shared comment controller. */
export class BookmarkThreads implements vscode.Disposable {
  private readonly threads = new Map<string, vscode.CommentThread>();

  constructor(private readonly controller: vscode.CommentController) {}

  show(b: Bookmark): vscode.CommentThread {
    this.threads.get(b.id)?.dispose();
    const first = b.ranges[0] ?? { start: 1, end: 1 };
    const thread = this.controller.createCommentThread(
      vscode.Uri.parse(b.uri, true),
      new vscode.Range(first.start - 1, 0, first.start - 1, 0),
      [],
    );
    thread.canReply = false;
    thread.label = b.changed ? 'Bookmarked explanation (code changed)' : 'Bookmarked explanation';
    thread.contextValue = 'bookmark';
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    const parts: string[] = [];
    if (b.note.trim()) {
      parts.push(`*${safeMarkdown(b.note.trim())}*`);
    }
    if (b.question) {
      parts.push(`**Q:** ${safeMarkdown(b.question)}`);
    }
    parts.push(
      b.markdown.trim()
        ? safeMarkdown(b.markdown.trim())
        : '*No saved explanation. Explain again explains these lines.*',
    );
    if (b.changed) {
      parts.push(
        '*The code changed since this was saved; Explain again explains it as it is now.*',
      );
    }
    // Saved model output: same rendering rules as live output (arch §8).
    const body = new vscode.MarkdownString(parts.join('\n\n'));
    body.isTrusted = false;
    body.supportHtml = false;
    body.supportThemeIcons = false;
    thread.comments = [
      {
        author: {
          name: b.provider
            ? `LogicLens · ${b.provider}${b.model ? ` · ${b.model}` : ''}`
            : 'LogicLens',
        },
        label: new Date(b.createdAt).toLocaleDateString(),
        body,
        mode: vscode.CommentMode.Preview,
      },
    ];
    this.threads.set(b.id, thread);
    return thread;
  }

  idOf(thread: vscode.CommentThread): string | undefined {
    for (const [id, t] of this.threads) {
      if (t === thread) {
        return id;
      }
    }
    return undefined;
  }

  close(id: string): void {
    this.threads.get(id)?.dispose();
    this.threads.delete(id);
  }

  dispose(): void {
    this.threads.forEach((t) => t.dispose());
    this.threads.clear();
  }
}

function rangeLabel(r: { start: number; end: number }): string {
  return r.start === r.end ? `L${r.start}` : `L${r.start}–${r.end}`;
}

function fileName(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}
