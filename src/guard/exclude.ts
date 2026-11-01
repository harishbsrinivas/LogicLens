// Exclusion matching (spec §8): `logiclens.exclude` globs, the secret-file name guard, and
// `.logiclensignore` in gitignore syntax. Pure; settings are read in guard/settings.ts.
import picomatch from 'picomatch';
import ignore from 'ignore';

/** Always refused, whatever the settings say (SECURITY.md §1). */
export const SECRET_FILE_GLOBS = [
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa*',
  '**/credentials*',
  '**/*.tfvars',
  '**/*.kubeconfig',
];

export interface ExcludeInput {
  patterns: readonly string[];
  /** Contents of `.logiclensignore` at the workspace root, if any. */
  ignoreText?: string;
}

export interface PathInfo {
  /** Workspace-relative path with forward slashes, when the file is inside a workspace folder. */
  relPath?: string;
  /** Absolute path with forward slashes, for files outside any workspace. */
  absPath?: string;
}

export type ExcludeMatcher = (path: PathInfo) => boolean;

export function createExcludeMatcher(input: ExcludeInput): ExcludeMatcher {
  const globs = [...SECRET_FILE_GLOBS, ...input.patterns.filter((p) => p.trim() !== '')];
  const isMatch = picomatch(globs, { dot: true, nocase: true });
  const ig = input.ignoreText ? ignore().add(input.ignoreText) : undefined;
  return ({ relPath, absPath }) => {
    if (relPath && isMatch(relPath)) {
      return true;
    }
    if (absPath && isMatch(absPath)) {
      return true;
    }
    return Boolean(relPath && ig && ig.ignores(relPath));
  };
}
