// Trail breadcrumbs (arch §6, spec §13): a CodeLens row above line 1 of the file the trail is
// on, and "Explain <symbol>" above the definition the user followed to when the file has no
// walkthrough. Crumb commands carry only the entry index; the follow service validates it.
import * as vscode from 'vscode';
import { basename, type FollowService } from '../nav/follow';
import type { TrailEntry } from '../nav/trail';
import { SessionStore } from '../state/session';

/** More crumbs than this collapse the middle into "…" (spec §13). */
const MAX_CRUMBS = 4;

export class TrailCodeLens implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly subscriptions: vscode.Disposable[];

  readonly onDidChangeCodeLenses = this.changed.event;

  constructor(
    private readonly follow: FollowService,
    private readonly session: SessionStore,
    private readonly symbols: (doc: vscode.TextDocument) => Promise<vscode.DocumentSymbol[]>,
    private readonly excluded: (uri: vscode.Uri) => Promise<boolean>,
  ) {
    this.subscriptions = [
      follow.onDidChange(() => this.changed.fire()),
      session.onDidChange(() => this.changed.fire()),
    ];
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const { trail } = this.follow;
    const current = trail.at(trail.index);
    if (trail.size < 2 || current?.uri !== document.uri.toString()) {
      return [];
    }
    const top = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];
    let previous = -1;
    for (const i of visibleCrumbs(trail.size, trail.index)) {
      if (i > previous + 1) {
        lenses.push(
          new vscode.CodeLens(top, {
            title: '…',
            tooltip: 'Show the whole trail',
            command: 'logiclens.trailPick',
          }),
        );
      }
      previous = i;
      const entry = trail.at(i);
      if (entry) {
        lenses.push(new vscode.CodeLens(top, await this.crumb(entry, i, i === trail.index)));
      }
    }
    const explain = await this.explainLens(document, current);
    return explain ? [...lenses, explain] : lenses;
  }

  private async crumb(
    entry: TrailEntry,
    index: number,
    isCurrent: boolean,
  ): Promise<vscode.Command> {
    const uri = vscode.Uri.parse(entry.uri, true);
    const missing = !(await exists(uri));
    const locked = !missing && (await this.excluded(uri));
    const name = `${basename(uri)}${entry.symbol ? ` › ${entry.symbol}` : ''}`;
    return {
      title: `${isCurrent ? '● ' : ''}${locked ? '$(lock) ' : ''}${name}${missing ? ' (missing)' : ''}`,
      tooltip: `${uri.scheme === 'file' ? uri.fsPath : uri.toString()}:${entry.line}${isCurrent ? ' (you are here)' : ''}`,
      command: 'logiclens.trailGo',
      arguments: [index],
    };
  }

  /** "Explain <symbol>" above the symbol the user followed to, when there is no walkthrough. */
  private async explainLens(
    document: vscode.TextDocument,
    entry: TrailEntry,
  ): Promise<vscode.CodeLens | undefined> {
    if (this.session.get(SessionStore.key(document.uri)) || (await this.excluded(document.uri))) {
      return undefined;
    }
    let best: vscode.DocumentSymbol | undefined;
    const visit = (list: readonly vscode.DocumentSymbol[]): void => {
      for (const s of list) {
        if (s.range.start.line + 1 <= entry.line && entry.line <= s.range.end.line + 1) {
          best = s;
          visit(s.children);
        }
      }
    };
    visit(await this.symbols(document));
    if (!best) {
      return undefined;
    }
    const line = best.range.start.line;
    return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
      title: `Explain ${best.name.replace(/\$\(/g, '(')}`,
      tooltip: 'Explain this symbol with LogicLens',
      command: 'logiclens.explainSymbol',
      arguments: [document.uri.toString(), line + 1],
    });
  }

  dispose(): void {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.changed.dispose();
  }
}

/** Indexes to show: all when few; else the first, the current, and its neighbours. Pure. */
export function visibleCrumbs(size: number, current: number): number[] {
  if (size <= MAX_CRUMBS) {
    return [...Array(size).keys()];
  }
  const shown = new Set([0, current - 1, current, current + 1].filter((i) => i >= 0 && i < size));
  return [...shown].sort((a, b) => a - b);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  if (uri.scheme !== 'file') {
    return true;
  }
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
