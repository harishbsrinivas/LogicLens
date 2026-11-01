// Context keys for menus (spec §9). S1: `logiclens.fileExcluded`; `logiclens.busy` is set by
// the status bar.
import * as vscode from 'vscode';
import { isExcluded } from '../guard/settings';
import type { ActiveEditor } from './activeEditor';

export function trackFileExcluded(active: ActiveEditor): vscode.Disposable {
  let version = 0;
  const update = async (): Promise<void> => {
    const current = ++version;
    const editor = active.editor;
    const excluded = editor ? await isExcluded(editor.document.uri) : false;
    if (current === version) {
      await vscode.commands.executeCommand('setContext', 'logiclens.fileExcluded', excluded);
    }
  };
  void update();
  return vscode.Disposable.from(
    active.onDidChange(() => void update()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('logiclens.exclude')) {
        void update();
      }
    }),
  );
}
