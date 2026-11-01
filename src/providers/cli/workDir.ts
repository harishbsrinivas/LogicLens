// Isolated working directories for CLI requests (ADR-0005): a fresh empty folder under the
// extension's global storage per request, removed afterwards, so the CLI finds no project
// files or instruction files and has nothing of the user's to change.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkDir } from './claudeCode';

export function workDirFactory(base: string): () => Promise<WorkDir> {
  return async () => {
    await mkdir(base, { recursive: true });
    const path = await mkdtemp(join(base, 'run-'));
    return { path, dispose: () => rm(path, { recursive: true, force: true }) };
  };
}
