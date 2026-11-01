// Editor decorations (arch §6): focused step highlight with a left border, dimming outside it,
// the step number in the gutter, and a lock on lines withheld by the secret scan.
import * as vscode from 'vscode';
import { SessionStore } from '../state/session';
import type { LineRange } from '../state/types';

// Gutter icons must be images; theme variables are not available, so light and dark variants.
function svgUri(svg: string): vscode.Uri {
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function lockIcon(color: string): vscode.Uri {
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="none" stroke="${color}" stroke-width="1.3" d="M5 7V5a3 3 0 0 1 6 0v2"/><rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="${color}"/></svg>`,
  );
}

/** Outlined step number, so it reads on any theme background. */
function numberIcon(n: number, color: string): vscode.Uri {
  const size = n > 9 ? 8 : 10;
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3" fill="none" stroke="${color}" stroke-width="1.3"/><text x="8" y="11.5" font-family="sans-serif" font-size="${size}" font-weight="bold" text-anchor="middle" fill="${color}">${n}</text></svg>`,
  );
}

/** What was last applied to an editor; integration tests read it through the `TestApi`. */
export interface AppliedDecorations {
  focus: LineRange[];
  dimmed: number;
  number: number | null;
  withheld: number[];
}

export class Decorations implements vscode.Disposable {
  private readonly withheld = vscode.window.createTextEditorDecorationType({
    light: { gutterIconPath: lockIcon('#6c6c6c') },
    dark: { gutterIconPath: lockIcon('#a0a0a0') },
    gutterIconSize: '75%',
  });
  private readonly focus = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    isWholeLine: true,
    borderWidth: '0 0 0 2px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('focusBorder'),
  });
  private readonly dim = vscode.window.createTextEditorDecorationType({ opacity: '0.7' });
  private readonly numbers = new Map<number, vscode.TextEditorDecorationType>();
  private readonly applied = new Map<string, AppliedDecorations>();
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly session: SessionStore) {
    this.subscriptions = [
      vscode.window.onDidChangeVisibleTextEditors(() => this.applyAll()),
      session.onDidChange(() => this.applyAll()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('logiclens.focusDimming')) {
          this.applyAll();
        }
      }),
    ];
    this.applyAll();
  }

  appliedTo(uri: vscode.Uri): AppliedDecorations | undefined {
    return this.applied.get(uri.toString());
  }

  private numberType(n: number): vscode.TextEditorDecorationType {
    let type = this.numbers.get(n);
    if (!type) {
      type = vscode.window.createTextEditorDecorationType({
        light: { gutterIconPath: numberIcon(n, '#1a1a1a') },
        dark: { gutterIconPath: numberIcon(n, '#e0e0e0') },
        gutterIconSize: '90%',
      });
      this.numbers.set(n, type);
    }
    return type;
  }

  private applyAll(): void {
    this.applied.clear();
    const dimming = vscode.workspace
      .getConfiguration('logiclens')
      .get<boolean>('focusDimming', true);
    for (const editor of vscode.window.visibleTextEditors) {
      const doc = editor.document;
      const entry = this.session.get(SessionStore.key(doc.uri));
      const view = entry?.view;
      const step =
        entry && entry.focus !== null && view?.fallbackMarkdown === null
          ? view.steps.find((s) => s.index === entry.focus && s.anchored)
          : undefined;
      const focusRanges = (step?.ranges ?? []).filter((r) => r.start <= doc.lineCount);
      const first = focusRanges[0];

      editor.setDecorations(
        this.focus,
        focusRanges.map((r) => new vscode.Range(r.start - 1, 0, r.end - 1, 0)),
      );
      const dimRanges = dimming && first ? outside(focusRanges, doc.lineCount) : [];
      editor.setDecorations(this.dim, dimRanges);

      // Gutter icons do not stack; the step number wins over the lock (arch §6).
      const current = step && first ? step.index + 1 : null;
      const numberLine = first ? first.start : null;
      for (const [n, type] of this.numbers) {
        if (n !== current) {
          editor.setDecorations(type, []);
        }
      }
      if (current !== null && first) {
        editor.setDecorations(this.numberType(current), [lineRange(first.start)]);
      }
      const locks = (view?.withheld ?? []).filter((l) => l <= doc.lineCount && l !== numberLine);
      editor.setDecorations(
        this.withheld,
        locks.map((l) => ({
          range: lineRange(l),
          hoverMessage: 'Withheld by LogicLens: possible secret. This line was not sent.',
        })),
      );
      this.applied.set(doc.uri.toString(), {
        focus: focusRanges,
        dimmed: dimRanges.length,
        number: step ? step.index + 1 : null,
        withheld: locks,
      });
    }
  }

  dispose(): void {
    this.withheld.dispose();
    this.focus.dispose();
    this.dim.dispose();
    for (const type of this.numbers.values()) {
      type.dispose();
    }
    for (const s of this.subscriptions) {
      s.dispose();
    }
  }
}

function lineRange(line: number): vscode.Range {
  return new vscode.Range(line - 1, 0, line - 1, 0);
}

/** Whole-line ranges for every line outside `ranges` (1-based, inclusive, sorted). */
function outside(ranges: readonly LineRange[], lineCount: number): vscode.Range[] {
  const out: vscode.Range[] = [];
  let next = 1;
  for (const r of ranges) {
    if (r.start > next) {
      out.push(new vscode.Range(next - 1, 0, r.start - 2, Number.MAX_SAFE_INTEGER));
    }
    next = Math.max(next, r.end + 1);
  }
  if (next <= lineCount) {
    out.push(new vscode.Range(next - 1, 0, lineCount - 1, Number.MAX_SAFE_INTEGER));
  }
  return out;
}
