// Bookmark commands (spec §14, §9). Resolve the step, answer, or code; refuse excluded files;
// hash lines the secret scan flags (ADR-0020); then call the store. Only Explain again can lead
// to a request, through the normal explain command and its gate.
import * as vscode from 'vscode';
import { bookmarkMarkdown, type BookmarkKind, type BookmarkStore } from '../bookmarks/store';
import { isExcluded } from '../guard/settings';
import { scan } from '../guard/secretScan';
import type { QuestionStore } from '../state/questions';
import { storeLines } from '../state/reanchor';
import { SessionStore } from '../state/session';
import type { LineRange } from '../state/types';
import type { ActiveEditor } from '../ui/activeEditor';
import type { BookmarkDecorations, BookmarkNode, BookmarkThreads } from '../ui/bookmarksView';
import type { InlineThreads } from '../ui/inlineThreads';
import { isQuestionComment } from '../ui/questionThreads';
import type { InputFn } from './questions';

export interface BookmarkCommandDeps {
  store: BookmarkStore;
  session: SessionStore;
  questions: QuestionStore;
  inline: InlineThreads;
  threads: BookmarkThreads;
  decorations: BookmarkDecorations;
  active: ActiveEditor;
  input(): InputFn;
  confirm(message: string, action: string): Promise<boolean>;
}

export function registerBookmarkCommands(deps: BookmarkCommandDeps): vscode.Disposable[] {
  const { store, session } = deps;

  async function document(uri: string): Promise<vscode.TextDocument | undefined> {
    try {
      return await vscode.workspace.openTextDocument(vscode.Uri.parse(uri, true));
    } catch {
      return undefined;
    }
  }

  async function add(
    doc: vscode.TextDocument,
    kind: BookmarkKind,
    ranges: LineRange[],
    fields: {
      title?: string;
      markdown?: string;
      question?: string;
      provider?: string;
      model?: string;
    },
    withheld: readonly number[] = [],
  ): Promise<string | undefined> {
    if (await isExcluded(doc.uri)) {
      void vscode.window.showWarningMessage(
        'This file is excluded by LogicLens settings, so it cannot be bookmarked.',
      );
      return undefined;
    }
    const note = await deps.input()('Note for this bookmark (optional; press Enter to skip)', '');
    if (note === undefined) {
      return undefined;
    }
    const lines = doc.getText().split(/\r?\n/);
    // Lines the scan flags now, plus those the walkthrough withheld, are stored as hashes only.
    const flagged = new Set([
      ...withheld,
      ...ranges.flatMap((r) =>
        scan(lines.slice(r.start - 1, r.end), r.start).flagged.map((f) => f.line),
      ),
    ]);
    const firstCode = ranges
      .flatMap((r) => Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i))
      .find((l) => !flagged.has(l) && (lines[l - 1] ?? '').trim());
    const bookmark = await store.add({
      kind,
      uri: doc.uri.toString(),
      ranges,
      lines: ranges.map((r) => storeLines(lines, r, flagged)),
      title: fields.title ?? (firstCode ? (lines[firstCode - 1] ?? '').trim().slice(0, 120) : ''),
      markdown: fields.markdown ?? '',
      question: fields.question,
      note: note.trim(),
      provider: fields.provider,
      model: fields.model,
    });
    if (!bookmark) {
      void vscode.window.showWarningMessage(
        'LogicLens keeps up to 500 bookmarks. Remove some in the Bookmarks view first.',
      );
      return undefined;
    }
    return bookmark.id;
  }

  function nodeId(arg: unknown): string | undefined {
    if (typeof arg === 'string') {
      return store.get(arg)?.id;
    }
    if (typeof arg === 'object' && arg !== null && 'id' in arg && typeof arg.id === 'string') {
      return store.get(arg.id)?.id;
    }
    return undefined;
  }

  async function bookmarkStep(key: string, index: number): Promise<string | undefined> {
    const view = session.get(key)?.view;
    const step = view?.steps.find((s) => s.index === index && s.anchored);
    const doc = step && (await document(key));
    if (!view || !step || !doc) {
      return undefined;
    }
    const concepts =
      step.concepts.length > 0
        ? `\n\n${step.concepts.map((c) => `\`${c.replace(/`/g, '')}\``).join(' · ')}`
        : '';
    return add(
      doc,
      'step',
      step.ranges,
      {
        title: `${step.index + 1} · ${step.title}`,
        markdown: `${step.text.trim()}${concepts}`,
        provider: view.providerLabel,
        model: view.model,
      },
      view.withheld,
    );
  }

  return [
    vscode.commands.registerCommand('logiclens.addBookmark', async () => {
      const editor = deps.active.editor;
      if (!editor) {
        return undefined;
      }
      const sel = editor.selection;
      const end =
        sel.end.line > sel.start.line && sel.end.character === 0 ? sel.end.line - 1 : sel.end.line;
      return add(editor.document, 'code', [{ start: sel.start.line + 1, end: end + 1 }], {});
    }),
    // From the step thread title (the thread) or the step title CodeLens ([key, index]).
    vscode.commands.registerCommand('logiclens.bookmarkStep', (arg: unknown, index?: unknown) => {
      if (typeof arg === 'string' && typeof index === 'number') {
        return bookmarkStep(arg, index);
      }
      if (arg instanceof Object) {
        const thread = arg as vscode.CommentThread;
        const i = deps.inline.stepIndexOf(thread);
        return i === undefined ? undefined : bookmarkStep(SessionStore.key(thread.uri), i);
      }
      return undefined;
    }),
    vscode.commands.registerCommand('logiclens.bookmarkAnswer', async (comment: unknown) => {
      if (!isQuestionComment(comment)) {
        return undefined;
      }
      const thread = deps.questions.get(comment.threadId);
      const turn = thread?.turns.find((t) => t.id === comment.turnId);
      const doc = thread && (await document(thread.key));
      if (!thread || !turn || !doc) {
        return undefined;
      }
      return add(doc, 'answer', [thread.range], {
        title: turn.question.slice(0, 120),
        question: turn.question,
        markdown: turn.answer,
        provider: turn.providerLabel,
        model: turn.model,
      });
    }),
    vscode.commands.registerCommand('logiclens.showBookmark', async (arg: unknown) => {
      const b = store.get(nodeId(arg) ?? '');
      const doc = b && (await document(b.uri));
      const first = b?.ranges[0];
      if (!b || !doc || !first) {
        return undefined;
      }
      const editor = await vscode.window.showTextDocument(doc);
      const start = new vscode.Position(Math.min(first.start, doc.lineCount) - 1, 0);
      editor.selection = new vscode.Selection(start, start);
      editor.revealRange(
        new vscode.Range(Math.max(0, first.start - 2), 0, first.end - 1, 0),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
      deps.decorations.show(b.id);
      return deps.threads.show(b);
    }),
    vscode.commands.registerCommand('logiclens.editBookmarkNote', async (arg: unknown) => {
      const b = store.get(nodeId(arg) ?? '');
      if (!b) {
        return;
      }
      const note = await deps.input()('Bookmark note', b.note);
      if (note !== undefined) {
        await store.update(b.id, (x) => (x.note = note.trim()));
      }
    }),
    vscode.commands.registerCommand('logiclens.copyBookmarkMarkdown', async (arg: unknown) => {
      const b = store.get(nodeId(arg) ?? '');
      if (b) {
        const name = vscode.Uri.parse(b.uri, true).path.split('/').pop() ?? b.uri;
        await vscode.env.clipboard.writeText(bookmarkMarkdown(b, name));
      }
    }),
    vscode.commands.registerCommand('logiclens.removeBookmark', async (arg: unknown) => {
      const id = nodeId(arg);
      if (id) {
        deps.threads.close(id);
        await store.remove(id);
      }
    }),
    vscode.commands.registerCommand('logiclens.clearAllBookmarks', async () => {
      if (
        store.list().length > 0 &&
        (await deps.confirm(
          `Delete all ${store.list().length} LogicLens bookmarks? This cannot be undone.`,
          'Delete All',
        ))
      ) {
        store.list().forEach((b) => deps.threads.close(b.id));
        await store.clear();
        deps.decorations.show(undefined);
      }
    }),
    // Bookmarked explanation thread title: explains the bookmark's lines as they are now.
    vscode.commands.registerCommand('logiclens.explainBookmark', async (thread: unknown) => {
      const id =
        thread instanceof Object ? deps.threads.idOf(thread as vscode.CommentThread) : undefined;
      const b = id ? store.get(id) : undefined;
      const doc = b && (await document(b.uri));
      const first = b?.ranges[0];
      const last = b?.ranges[b.ranges.length - 1];
      if (!b || !doc || !first || !last) {
        return undefined;
      }
      const editor = await vscode.window.showTextDocument(doc);
      editor.selection = new vscode.Selection(
        first.start - 1,
        0,
        last.end - 1,
        doc.lineAt(last.end - 1).text.length,
      );
      deps.threads.close(b.id);
      return vscode.commands.executeCommand('logiclens.explainSelection');
    }),
    vscode.commands.registerCommand('logiclens.closeBookmarkThread', (thread: unknown) => {
      const id =
        thread instanceof Object ? deps.threads.idOf(thread as vscode.CommentThread) : undefined;
      if (id) {
        deps.threads.close(id);
        deps.decorations.show(undefined);
      }
    }),
  ];
}

export type { BookmarkNode };
