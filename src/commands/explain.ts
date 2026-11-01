// Explain commands (spec §9). Thin: resolve the target, call the service, report refusals.
import * as vscode from 'vscode';
import { rangeText } from '../explain/context';
import { documentSymbols, flattenSymbols } from '../explain/symbols';
import type { ExplainOptions, ExplainResult, ExplainService } from '../explain/walkthrough';
import { guardSettings } from '../guard/settings';
import { MAX_BYTES } from '../guard/size';
import { SessionStore } from '../state/session';
import type { LineRange } from '../state/types';
import type { ActiveEditor } from '../ui/activeEditor';
import type { PickerEntry } from '../ui/providerPicker';
import type { PickFn } from './provider';
import { reportRefusal as reportRefusalMessage, showWithChooseProvider } from './refusals';
import { threadUri } from './steps';

export interface ExplainCommandDeps {
  service: ExplainService;
  session: SessionStore;
  active: ActiveEditor;
  pick(): PickFn;
}

export function registerExplainCommands(deps: ExplainCommandDeps): vscode.Disposable[] {
  const { service, session, active } = deps;

  // Thread title actions pass their comment thread; the palette passes nothing; the editor
  // title and the Explorer pass the file's Uri.
  async function targetEditor(arg: unknown): Promise<vscode.TextEditor | undefined> {
    if (arg instanceof vscode.Uri) {
      const shown = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === arg.toString(),
      );
      // From the Explorer: open the file in a preview tab (spec §3).
      return shown ?? vscode.window.showTextDocument(arg, { preview: true });
    }
    const uri = threadUri(arg);
    if (!uri) {
      return active.editor;
    }
    return vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString(),
    );
  }

  async function explain(
    editor: vscode.TextEditor | undefined,
    options: ExplainOptions,
  ): Promise<ExplainResult> {
    if (!editor) {
      void vscode.window.showInformationMessage('Open a file to explain it with LogicLens.');
      return { kind: 'refused', reason: 'cancelled', message: 'No active editor.' };
    }
    if (editor.document.uri.scheme === 'vscode-notebook-cell') {
      void vscode.window.showInformationMessage('LogicLens does not explain notebooks yet.');
      return { kind: 'refused', reason: 'cancelled', message: 'Notebooks are not supported.' };
    }
    const result = await service.explainFile(editor.document, options);
    if (result.kind === 'refused') {
      reportRefusalMessage(
        result,
        () => void explain(editor, { ...options, secretsAction: 'skip-lines' }),
      );
    } else if (
      result.kind === 'failed' &&
      (result.category === 'auth' || result.category === 'quota' || result.category === 'not-found')
    ) {
      showWithChooseProvider(result.message);
    }
    return result;
  }

  async function explainFile(arg: unknown, options: ExplainOptions): Promise<ExplainResult> {
    const editor = await targetEditor(arg);
    if (!editor) {
      return explain(undefined, options);
    }
    const key = SessionStore.key(editor.document.uri);
    if (!options.target && arg !== undefined && !(arg instanceof vscode.Uri)) {
      // Explain again and Regenerate with… keep the walkthrough's selection or symbol.
      options = { ...options, target: session.get(key)?.view.target ?? undefined };
    }
    if (!options.target && arg instanceof vscode.Uri && editor === vscode.window.activeTextEditor) {
      // The editor title button explains the selection when there is one (spec §3).
      options = { ...options, target: selectionLines(editor) };
    }
    if (!options.target && tooLarge(editor.document)) {
      const target = await largeFileTarget(editor);
      if (!target) {
        return { kind: 'refused', reason: 'cancelled', message: 'Cancelled.' };
      }
      options = { ...options, target };
    }
    return explain(editor, options);
  }

  /** Over the size limit: offer the selection, the visible range, or a symbol (spec §3). */
  async function largeFileTarget(editor: vscode.TextEditor): Promise<LineRange | undefined> {
    const { maxLines } = guardSettings();
    const visible = editor.visibleRanges[0];
    const selection = selectionLines(editor);
    const entries: PickerEntry[] = [];
    if (selection) {
      entries.push(item('selection', 'Selection', rangeText(selection)));
    }
    if (visible) {
      entries.push(
        item('visible', 'Visible range', rangeText(lineRange(visible.start, visible.end))),
      );
    }
    entries.push(item('symbol', 'Choose a symbol…', 'a function, method, or class'));
    const choice = await deps.pick()(
      entries,
      `${editor.document.lineCount} lines is over the ${maxLines}-line limit. Explain part of it:`,
    );
    if (choice === 'selection') {
      return selection;
    }
    if (choice === 'visible' && visible) {
      return lineRange(visible.start, visible.end);
    }
    return choice === 'symbol' ? pickSymbol(editor.document) : undefined;
  }

  async function pickSymbol(document: vscode.TextDocument): Promise<LineRange | undefined> {
    const symbols = flattenSymbols(await documentSymbols(document));
    if (symbols.length === 0) {
      void vscode.window.showInformationMessage('No symbols were found in this file.');
      return undefined;
    }
    const value = await deps.pick()(
      symbols.map((s, i) =>
        item(
          String(i),
          `${'  '.repeat(s.depth)}${s.symbol.name}`,
          `${vscode.SymbolKind[s.symbol.kind]} · L${s.symbol.range.start.line + 1}`,
        ),
      ),
      'LogicLens: Explain Symbol',
    );
    const chosen = value === undefined ? undefined : symbols[Number(value)];
    return chosen && lineRange(chosen.symbol.range.start, chosen.symbol.range.end);
  }

  return [
    // The second argument comes only from Regenerate with…; its shape is checked.
    vscode.commands.registerCommand('logiclens.explainFile', (arg?: unknown, options?: unknown) =>
      explainFile(arg, providerOverride(options)),
    ),
    vscode.commands.registerCommand('logiclens.explainSelection', () => {
      const editor = active.editor;
      const target = editor && selectionLines(editor);
      if (!editor || !target) {
        void vscode.window.showInformationMessage('Select some code to explain it with LogicLens.');
        return undefined;
      }
      return explain(editor, { target });
    }),
    // From the Explain CodeLens: [document key, 1-based line]. The symbol is looked up again.
    vscode.commands.registerCommand(
      'logiclens.explainSymbol',
      async (key?: unknown, line?: unknown) => {
        let editor = active.editor;
        let target: LineRange | undefined;
        if (typeof key === 'string' && typeof line === 'number' && Number.isSafeInteger(line)) {
          editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === key);
          const found =
            editor &&
            flattenSymbols(await documentSymbols(editor.document)).find(
              (s) => s.symbol.range.start.line === line - 1,
            );
          target = found && lineRange(found.symbol.range.start, found.symbol.range.end);
        } else if (editor) {
          target = await pickSymbol(editor.document);
        }
        return editor && target ? explain(editor, { target }) : undefined;
      },
    ),
    vscode.commands.registerCommand('logiclens.stop', async (arg?: unknown) => {
      const editor = await targetEditor(arg);
      if (editor && session.isBusy(SessionStore.key(editor.document.uri))) {
        session.stop(SessionStore.key(editor.document.uri));
        return;
      }
      session.stopAll();
    }),
    vscode.commands.registerCommand('logiclens.continue', async (arg?: unknown) => {
      const editor = await targetEditor(arg);
      if (!editor) {
        return undefined;
      }
      const result = await service.continue(editor.document);
      if (result.kind === 'refused' && result.reason !== 'cancelled') {
        reportRefusalMessage(result);
      }
      return result;
    }),
    vscode.commands.registerCommand('logiclens.closeExplanation', (arg?: unknown) => {
      const uri = threadUri(arg) ?? active.editor?.document.uri;
      if (uri) {
        session.delete(SessionStore.key(uri));
      }
    }),
  ];
}

function item(value: string, label: string, description: string): PickerEntry {
  return { kind: 'item', label, description, value, picked: false };
}

/** Whole lines of a non-empty selection; a selection ending at column 0 leaves that line out. */
function selectionLines(editor: vscode.TextEditor): LineRange | undefined {
  const sel = editor.selection;
  return sel.isEmpty ? undefined : lineRange(sel.start, sel.end);
}

function lineRange(start: vscode.Position, end: vscode.Position): LineRange {
  const last = end.line > start.line && end.character === 0 ? end.line - 1 : end.line;
  return { start: start.line + 1, end: last + 1 };
}

function tooLarge(document: vscode.TextDocument): boolean {
  return (
    document.lineCount > guardSettings().maxLines ||
    Buffer.byteLength(document.getText(), 'utf8') > MAX_BYTES
  );
}

function providerOverride(options: unknown): ExplainOptions {
  if (typeof options !== 'object' || options === null || !('provider' in options)) {
    return {};
  }
  const p = options.provider;
  if (
    typeof p === 'object' &&
    p !== null &&
    'provider' in p &&
    typeof p.provider === 'string' &&
    (!('model' in p) || typeof p.model === 'string')
  ) {
    return { provider: { provider: p.provider, model: 'model' in p ? (p.model as string) : '' } };
  }
  return {};
}
