// Reads the guard's settings and builds the exclusion matcher for a document (spec §8, §9).
import * as vscode from 'vscode';
import { createExcludeMatcher, type PathInfo } from './exclude';
import type { SecretsAction } from './gate';
import {
  AUDIENCES,
  DEPTHS,
  JARGONS,
  type Audience,
  type Depth,
  type ExplanationStyle,
  type Jargon,
} from '../prompts/style';
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

/** Depth, audience, jargon, and language for a document (spec §4, §9; resource scope). */
export function explanationStyle(scope?: vscode.Uri): ExplanationStyle {
  const config = vscode.workspace.getConfiguration('logiclens', scope);
  const pick = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = config.get<string>(key);
    return values.find((v) => v === value) ?? fallback;
  };
  const language = config.get<string>('explanationLanguage', 'auto').trim();
  return {
    depth: pick<Depth>('depth', DEPTHS, 'standard'),
    audience: pick<Audience>('audience', AUDIENCES, 'practitioner'),
    jargon: pick<Jargon>('jargon', JARGONS, 'auto'),
    // BCP 47 tags only; anything else falls back to the display language.
    language:
      language && language !== 'auto' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language)
        ? language
        : vscode.env.language,
  };
}

/** `logiclens.provider` and `logiclens.model` (application scope, spec §9). */
export function providerSettings(): { provider: string; model: string } {
  const config = vscode.workspace.getConfiguration('logiclens');
  return {
    provider: config.get<string>('provider', 'auto') || 'auto',
    model: config.get<string>('model', '') ?? '',
  };
}

/** CLI provider settings (spec §9). `cli.claudePath` is machine scope, so a workspace cannot set it. */
export function cliSettings(): { claudePath: string; timeoutMs: number } {
  const config = vscode.workspace.getConfiguration('logiclens');
  const seconds = config.get<number>('cli.timeoutSeconds', 180);
  return {
    claudePath: config.get<string>('cli.claudePath', '').trim() || 'claude',
    timeoutMs: (Number.isFinite(seconds) && seconds > 0 ? seconds : 180) * 1000,
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
