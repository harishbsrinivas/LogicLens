// Follow to Definition and trail navigation (spec §13, ADR-0021). Uses the language's own
// definition provider on this machine; never imports providers or the gate, so following can
// never send code (arch §3).
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import type { PickerEntry } from '../ui/providerPicker';
import { Trail, type TrailEntry } from './trail';

export const TRAIL_STATE_KEY = 'trail';

export type FollowResult = 'followed' | 'none' | 'cancelled';

export interface FollowDeps {
  session: SessionStore;
  state: vscode.Memento;
  pick(entries: PickerEntry[], title: string): Thenable<string | undefined>;
  /** Restores a document's walkthrough from the cache, if it has none in memory (S8). */
  restore(document: vscode.TextDocument): Promise<unknown>;
}

export class FollowService implements vscode.Disposable {
  readonly trail = new Trail();
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  constructor(private readonly deps: FollowDeps) {
    this.trail.restore(deps.state.get(TRAIL_STATE_KEY));
    this.publish();
  }

  /** Follows the identifier at `position` to its definition and records both ends. */
  async followAt(editor: vscode.TextEditor, position: vscode.Position): Promise<FollowResult> {
    const symbol = wordAt(editor.document, position);
    const found = await definitions(editor.document.uri, position);
    if (found.length === 0) {
      vscode.window.setStatusBarMessage(
        `LogicLens: no definition found${symbol ? ` for ${symbol}` : ''}.`,
        5000,
      );
      return 'none';
    }
    let target = found[0];
    if (found.length > 1) {
      const value = await this.deps.pick(
        await Promise.all(
          found.map(async (loc, i): Promise<PickerEntry> => ({
            kind: 'item',
            label: `${basename(loc.uri)}:${loc.range.start.line + 1}`,
            description: await preview(loc),
            value: String(i),
            picked: false,
          })),
        ),
        `LogicLens: Follow ${symbol ?? 'definition'}`,
      );
      target = value === undefined ? undefined : found[Number(value)];
    }
    if (!target) {
      return 'cancelled';
    }
    const from = this.snapshot(editor, position, symbol);
    const dest = await vscode.window.showTextDocument(target.uri, {
      selection: new vscode.Range(target.range.start, target.range.start),
    });
    const at = dest.selection.active;
    this.trail.follow(from, {
      uri: dest.document.uri.toString(),
      symbol: wordAt(dest.document, at),
      line: at.line + 1,
      character: at.character,
      scrollTop: (dest.visibleRanges[0]?.start.line ?? at.line) + 1,
      step: null,
    });
    await this.save();
    return 'followed';
  }

  back(): Promise<boolean> {
    return this.go(this.trail.index - 1, 'Back to');
  }

  forward(): Promise<boolean> {
    return this.go(this.trail.index + 1, 'Forward to');
  }

  /** Opens entry `index` with its cursor, scroll, and focused step (spec §13). */
  async go(index: number, verb = 'Went to'): Promise<boolean> {
    const entry = this.trail.at(index);
    if (!entry || index === this.trail.index) {
      return false;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === this.trail.at(this.trail.index)?.uri) {
      this.trail.update(
        this.snapshot(editor, editor.selection.active, this.trail.at(this.trail.index)?.symbol),
      );
    }
    const uri = vscode.Uri.parse(entry.uri, true);
    if (!(await exists(uri))) {
      const remove = 'Remove from Trail';
      const choice = await vscode.window.showWarningMessage(
        `${basename(uri)} no longer exists.`,
        remove,
      );
      if (choice === remove) {
        this.trail.remove(index);
        await this.save();
      }
      return false;
    }
    this.trail.goTo(index);
    await this.save();
    const document = await vscode.workspace.openTextDocument(uri);
    const line = Math.min(entry.line, document.lineCount) - 1;
    const pos = new vscode.Position(Math.max(0, line), entry.character);
    const shown = await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(pos, pos),
    });
    const top = Math.min(Math.max(0, entry.scrollTop - 1), document.lineCount - 1);
    shown.revealRange(new vscode.Range(top, 0, top, 0), vscode.TextEditorRevealType.AtTop);
    await this.deps.restore(document);
    const key = SessionStore.key(uri);
    const steps = this.deps.session.get(key)?.view.steps ?? [];
    const step =
      entry.step === null ? undefined : steps.find((s) => s.index === entry.step && s.anchored);
    if (step) {
      this.deps.session.setFocus(key, step.index, true);
    }
    vscode.window.setStatusBarMessage(
      `${verb} ${basename(uri)}${entry.symbol ? `, ${entry.symbol}` : ''}${step ? `, step ${step.index + 1}` : ''}`,
      5000,
    );
    return true;
  }

  async clear(): Promise<void> {
    this.trail.clear();
    await this.save();
  }

  private snapshot(
    editor: vscode.TextEditor,
    position: vscode.Position,
    symbol?: string,
  ): TrailEntry {
    const key = SessionStore.key(editor.document.uri);
    return {
      uri: key,
      symbol,
      line: position.line + 1,
      character: position.character,
      scrollTop: (editor.visibleRanges[0]?.start.line ?? position.line) + 1,
      step: this.deps.session.get(key)?.focus ?? null,
    };
  }

  private async save(): Promise<void> {
    await this.deps.state.update(TRAIL_STATE_KEY, this.trail.serialize());
    this.publish();
  }

  private publish(): void {
    void vscode.commands.executeCommand(
      'setContext',
      'logiclens.trailCanGoBack',
      this.trail.canGoBack,
    );
    void vscode.commands.executeCommand(
      'setContext',
      'logiclens.trailCanGoForward',
      this.trail.canGoForward,
    );
    this.changed.fire();
  }

  dispose(): void {
    this.changed.dispose();
  }
}

/** Definition locations from the language's provider, as plain locations. */
export async function definitions(
  uri: vscode.Uri,
  position: vscode.Position,
): Promise<vscode.Location[]> {
  try {
    const found = await vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[] | undefined
    >('vscode.executeDefinitionProvider', uri, position);
    return (found ?? []).map((d) =>
      'targetUri' in d
        ? new vscode.Location(d.targetUri, d.targetSelectionRange ?? d.targetRange)
        : d,
    );
  } catch {
    return [];
  }
}

export function wordAt(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  const range = document.getWordRangeAtPosition(position);
  return range ? document.getText(range) : undefined;
}

export function basename(uri: vscode.Uri): string {
  return uri.path.slice(uri.path.lastIndexOf('/') + 1);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  if (
    uri.scheme === 'untitled' ||
    vscode.workspace.textDocuments.some((d) => d.uri.toString() === uri.toString())
  ) {
    return true;
  }
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function preview(loc: vscode.Location): Promise<string> {
  try {
    const doc = await vscode.workspace.openTextDocument(loc.uri);
    return doc.lineAt(loc.range.start.line).text.trim().slice(0, 80);
  } catch {
    return '';
  }
}
