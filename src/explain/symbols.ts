// Document symbols for context windows (spec §5) through the language's symbol provider.
import * as vscode from 'vscode';
import type { LineRange } from '../state/types';

export async function documentSymbols(
  document: vscode.TextDocument,
): Promise<vscode.DocumentSymbol[]> {
  try {
    const found = await vscode.commands.executeCommand<
      (vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined
    >('vscode.executeDocumentSymbolProvider', document.uri);
    // Providers that return flat SymbolInformation have no ranges for bodies; skip them.
    return (found ?? []).filter((s): s is vscode.DocumentSymbol => 'children' in s);
  } catch {
    return [];
  }
}

/** The innermost symbol whose range contains `range`, as 1-based lines. */
export async function enclosingSymbol(
  document: vscode.TextDocument,
  range: LineRange,
): Promise<LineRange | undefined> {
  let best: LineRange | undefined;
  const visit = (symbols: readonly vscode.DocumentSymbol[]): void => {
    for (const s of symbols) {
      const r = { start: s.range.start.line + 1, end: s.range.end.line + 1 };
      if (r.start <= range.start && r.end >= range.end) {
        best = r;
        visit(s.children);
      }
    }
  };
  visit(await documentSymbols(document));
  return best;
}

/** Symbols in document order with their nesting depth, for pickers and CodeLens. */
export function flattenSymbols(
  symbols: readonly vscode.DocumentSymbol[],
  depth = 0,
): { symbol: vscode.DocumentSymbol; depth: number }[] {
  return [...symbols]
    .sort((a, b) => a.range.start.compareTo(b.range.start))
    .flatMap((symbol) => [{ symbol, depth }, ...flattenSymbols(symbol.children, depth + 1)]);
}
