// Question commands (spec §5, §9). Thin: resolve the document, thread, or comment, then call
// the question service. Menu commands take only ids from our own comments and threads.
import * as vscode from 'vscode';
import { validateQuestion, type AskResult, type QuestionService } from '../explain/question';
import type { QuestionStore } from '../state/questions';
import { SessionStore } from '../state/session';
import type { LineRange } from '../state/types';
import type { ActiveEditor } from '../ui/activeEditor';
import type { InlineThreads } from '../ui/inlineThreads';
import { isQuestionComment, type QuestionThreads } from '../ui/questionThreads';
import { reportRefusal } from './refusals';

/** Shows an input box; swapped in tests. Resolves undefined when dismissed. */
export type InputFn = (prompt: string, value: string) => Thenable<string | undefined>;

export interface QuestionCommandDeps {
  service: QuestionService;
  store: QuestionStore;
  ui: QuestionThreads;
  inline: InlineThreads;
  session: SessionStore;
  active: ActiveEditor;
  input(): InputFn;
}

export function registerQuestionCommands(deps: QuestionCommandDeps): vscode.Disposable[] {
  const { service, store, ui, inline, session, active } = deps;

  function documentFor(uri: vscode.Uri): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  }

  async function ask(thread: vscode.CommentThread, text: string): Promise<AskResult | undefined> {
    const invalid = validateQuestion(text);
    if (invalid?.kind === 'refused') {
      void vscode.window.showWarningMessage(invalid.message);
      return invalid;
    }
    const document = documentFor(thread.uri);
    if (!document) {
      return undefined;
    }
    const id = ui.adopt(thread, SessionStore.key(document.uri));
    const result = await service.ask(document, id, text);
    if (result.kind === 'refused') {
      reportRefusal(result);
    }
    return result;
  }

  function turnOf(arg: unknown): { threadId: string; turnId: string; part: string } | undefined {
    if (!isQuestionComment(arg) || !store.get(arg.threadId)) {
      return undefined;
    }
    return arg;
  }

  function stepFor(key: string, index: unknown): LineRange[] | undefined {
    if (typeof index !== 'number' || !Number.isSafeInteger(index)) {
      return undefined;
    }
    const step = session.get(key)?.view.steps.find((s) => s.index === index && s.anchored);
    return step?.ranges;
  }

  /** Opens a question thread at a step's first line, about the step's lines (spec §5). */
  function openAtStep(uri: vscode.Uri, ranges: LineRange[]): vscode.CommentThread | undefined {
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    if (!first || !last) {
      return undefined;
    }
    return ui.open(
      uri,
      { start: first.start, end: last.end },
      { start: first.start, end: first.start },
    );
  }

  return [
    vscode.commands.registerCommand('logiclens.askAtLine', () => {
      const editor = active.editor;
      if (!editor) {
        void vscode.window.showInformationMessage('Open a file to ask LogicLens about a line.');
        return undefined;
      }
      const sel = editor.selection;
      // A selection ending at the start of a line does not include that line.
      const endLine =
        sel.end.line > sel.start.line && sel.end.character === 0 ? sel.end.line - 1 : sel.end.line;
      return ui.open(editor.document.uri, { start: sel.start.line + 1, end: endLine + 1 });
    }),
    // The comment widget's submit button (reply or new thread) passes a CommentReply.
    vscode.commands.registerCommand('logiclens.submitQuestion', (reply: unknown) => {
      if (
        typeof reply !== 'object' ||
        reply === null ||
        !('thread' in reply) ||
        !('text' in reply) ||
        typeof reply.text !== 'string'
      ) {
        return undefined;
      }
      return ask(reply.thread as vscode.CommentThread, reply.text);
    }),
    vscode.commands.registerCommand('logiclens.stopQuestion', (thread: unknown) => {
      const id = thread instanceof Object ? ui.idOf(thread as vscode.CommentThread) : undefined;
      if (id) {
        service.stop(id);
      } else {
        service.stopAll();
      }
    }),
    vscode.commands.registerCommand('logiclens.copyAnswer', async (comment: unknown) => {
      const ref = turnOf(comment);
      const turn = ref && store.get(ref.threadId)?.turns.find((t) => t.id === ref.turnId);
      if (turn) {
        await vscode.env.clipboard.writeText(turn.answer.trim());
      }
    }),
    vscode.commands.registerCommand('logiclens.regenerateAnswer', async (comment: unknown) => {
      const ref = turnOf(comment);
      const thread = ref && store.get(ref.threadId);
      const document = thread && documentFor(vscode.Uri.parse(thread.key, true));
      if (!ref || !document) {
        return undefined;
      }
      const result = await service.regenerate(document, ref.threadId, ref.turnId);
      if (result?.kind === 'refused') {
        reportRefusal(result);
      }
      return result;
    }),
    // Deleting the first question deletes the thread; any other comment removes its turn.
    vscode.commands.registerCommand('logiclens.deleteQuestionComment', (comment: unknown) => {
      const ref = turnOf(comment);
      const thread = ref && store.get(ref.threadId);
      if (!ref || !thread) {
        return;
      }
      if (ref.part === 'question' && thread.turns[0]?.id === ref.turnId) {
        service.stop(ref.threadId);
        store.delete(ref.threadId);
        return;
      }
      if (service.isBusy(ref.threadId)) {
        service.stop(ref.threadId);
      }
      store.update(ref.threadId, (t) => (t.turns = t.turns.filter((x) => x.id !== ref.turnId)));
      if (store.get(ref.threadId)?.turns.length === 0) {
        store.delete(ref.threadId);
      }
    }),
    // Step thread title action: the thread is ours; its step comes from the inline renderer.
    vscode.commands.registerCommand('logiclens.askStep', (thread: unknown) => {
      if (!(thread instanceof Object)) {
        return undefined;
      }
      const t = thread as vscode.CommentThread;
      const index = inline.stepIndexOf(t);
      const ranges = index === undefined ? undefined : stepFor(SessionStore.key(t.uri), index);
      return ranges && openAtStep(t.uri, ranges);
    }),
    // Concept tag links carry [document key, step index, concept index]; all are checked.
    vscode.commands.registerCommand(
      'logiclens.askConcept',
      async (key: unknown, stepIndex: unknown, conceptIndex: unknown) => {
        if (typeof key !== 'string' || typeof conceptIndex !== 'number') {
          return undefined;
        }
        const step = session.get(key)?.view.steps.find((s) => s.index === stepIndex);
        const concept = step?.concepts[conceptIndex];
        const ranges = stepFor(key, stepIndex);
        if (!concept || !ranges) {
          return undefined;
        }
        const text = await deps.input()(
          `Ask LogicLens about "${concept}"`,
          `What is ${concept}, and how is it used here?`,
        );
        const thread = text?.trim() ? openAtStep(vscode.Uri.parse(key, true), ranges) : undefined;
        return thread && text ? ask(thread, text) : undefined;
      },
    ),
    // Line links in answers carry [document key, line]; the line is checked against the document.
    vscode.commands.registerCommand('logiclens.revealLine', async (key: unknown, line: unknown) => {
      if (typeof key !== 'string' || typeof line !== 'number' || !Number.isSafeInteger(line)) {
        return;
      }
      const document = documentFor(vscode.Uri.parse(key, true));
      if (!document || line < 1 || line > document.lineCount) {
        return;
      }
      const editor = await vscode.window.showTextDocument(document, { preserveFocus: false });
      const pos = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
    }),
    vscode.commands.registerCommand('logiclens.clearThreadsInFile', () => {
      const uri = active.editor?.document.uri;
      if (!uri) {
        return;
      }
      for (const t of store.inDocument(SessionStore.key(uri))) {
        service.stop(t.id);
        store.delete(t.id);
      }
      ui.discardPending(uri);
    }),
    vscode.commands.registerCommand('logiclens.clearAllThreads', () => {
      service.stopAll();
      for (const t of store.all()) {
        store.delete(t.id);
      }
      ui.discardPending();
    }),
  ];
}
