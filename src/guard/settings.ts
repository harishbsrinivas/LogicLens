// Reads the guard's settings and builds the exclusion matcher for a document (spec §8, §9).
import * as vscode from 'vscode';
import { createExcludeMatcher, type PathInfo } from './exclude';
import type { SecretsAction } from './gate';
import { DEFAULT_MAX_LINES } from './size';

export const IGNORE_FILE = '.logiclensignore';

export function guardSettings(): { maxLines: number; secretsAction: SecretsAction } {
  const config = vscode.workspace.getConfiguration('logiclens');
  const maxLines = config.get<number>('maxLines', DEFAULT_MAX_LINES);
  return {
    maxLines: Number.isFinite(maxLines) && maxLines > 0 ? maxLines : DEFAULT_MAX_LINES,
    secretsAction:
      config.get<string>('secrets.action') === 'refuse-file' ? 'refuse-file' : 'skip-lines',
  };
}

/**
 * Workspace values are added to the user's patterns, never replacing them, so a repository
 * cannot remove a user's exclusions (spec §9).
 */
export function excludePatterns(scope?: vscode.Uri): string[] {
  const info = vscode.workspace.getConfiguration('logiclens', scope).inspect<string[]>('exclude');
  const lists = [
    info?.globalValue ?? info?.defaultValue,
    info?.workspaceValue,
    info?.workspaceFolderValue,
  ];
  return [...new Set(lists.flatMap((l) => (Array.isArray(l) ? l : [])))].filter(
    (p): p is string => typeof p === 'string',
  );
}

export function pathInfo(uri: vscode.Uri): PathInfo {
  if (uri.scheme === 'untitled') {
    return {};
  }
  if (uri.scheme !== 'file') {
    // Diff views and other schemes still match the globs by path, so exclusions fail closed.
    return { absPath: uri.path };
  }
  const absPath = uri.fsPath.replace(/\\/g, '/');
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return { absPath };
  }
  const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
  return { relPath, absPath };
}

async function readIgnoreFile(uri: vscode.Uri): Promise<string | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return undefined;
  }
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, IGNORE_FILE));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/** Takes the gate's path info; files without a path (untitled) match nothing. */
export async function isPathExcluded(path: PathInfo): Promise<boolean> {
  if (!path.absPath) {
    return false;
  }
  const uri = vscode.Uri.file(path.absPath);
  const matcher = createExcludeMatcher({
    patterns: excludePatterns(uri),
    ignoreText: await readIgnoreFile(uri),
  });
  return matcher(path);
}

export function isExcluded(uri: vscode.Uri): Promise<boolean> {
  return isPathExcluded(pathInfo(uri));
}
