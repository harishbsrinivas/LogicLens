// Follow and trail commands (spec §13, §9). Thin: resolve the editor and position, then call the
// follow service. Crumb commands take only an entry index, which the service checks.
import * as vscode from 'vscode';
import { definitions, type FollowService } from '../nav/follow';
import { identifiersIn } from '../nav/trail';
import { SessionStore } from '../state/session';
import type { ActiveEditor } from '../ui/activeEditor';
import type { InlineThreads } from '../ui/inlineThreads';
import type { PickerEntry } from '../ui/providerPicker';
import type { PickFn } from './provider';

export interface TrailCommandDeps {
  follow: FollowService;
  session: SessionStore;
  active: ActiveEditor;
  inline: InlineThreads;
  pick(): PickFn;
}

export function registerTrailCommands(deps: TrailCommandDeps): vscode.Disposable[] {
  const { follow, active } = deps;

  return [
    vscode.commands.registerCommand('logiclens.followDefinition', () => {
      const editor = active.editor;
      return editor ? follow.followAt(editor, editor.selection.active) : undefined;
    }),
    // Step thread title: identifiers on the step's lines that have a definition (spec §13).
    vscode.commands.registerCommand('logiclens.followFromStep', async (thread: unknown) => {
      if (!(thread instanceof Object)) {
        return undefined;
      }
      const t = thread as vscode.CommentThread;
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === t.uri.toString(),
      );
      const index = deps.inline.stepIndexOf(t);
      const step = deps.session
        .get(SessionStore.key(t.uri))
        ?.view.steps.find((s) => s.index === index);
      if (!editor || !step) {
        return undefined;
      }
      const lines = editor.document.getText().split(/\r?\n/);
      const candidates = identifiersIn(lines, step.ranges);
      const withDefinition = (
        await Promise.all(
          candidates.map(async (c) => {
            const pos = new vscode.Position(c.line - 1, c.character);
            const found = await definitions(editor.document.uri, pos);
            // A definition on the same spot is the declaration itself; nothing to follow.
            const elsewhere = found.some(
              (d) => d.uri.toString() !== editor.document.uri.toString() || !d.range.contains(pos),
            );
            return elsewhere ? c : undefined;
          }),
        )
      ).filter((c) => c !== undefined);
      if (withDefinition.length === 0) {
        vscode.window.setStatusBarMessage(
          'LogicLens: nothing in this step has a definition to follow.',
          5000,
        );
        return 'none';
      }
      const value = await deps.pick()(
        withDefinition.map((c, i): PickerEntry => ({
          kind: 'item',
          label: c.name,
          description: `L${c.line}`,
          value: String(i),
          picked: false,
        })),
        `LogicLens: Follow from step ${step.index + 1}`,
      );
      const chosen = value === undefined ? undefined : withDefinition[Number(value)];
      return chosen
        ? follow.followAt(editor, new vscode.Position(chosen.line - 1, chosen.character))
        : 'cancelled';
    }),
    vscode.commands.registerCommand('logiclens.trailBack', () => follow.back()),
    vscode.commands.registerCommand('logiclens.trailForward', () => follow.forward()),
    vscode.commands.registerCommand('logiclens.trailGo', (index: unknown) =>
      typeof index === 'number' ? follow.go(index) : false,
    ),
    vscode.commands.registerCommand('logiclens.trailPick', async () => {
      const entries = follow.trail.all().map((e, i): PickerEntry => ({
        kind: 'item',
        label: `${i === follow.trail.index ? '● ' : ''}${vscode.Uri.parse(e.uri, true).path.split('/').pop() ?? e.uri}`,
        description: `${e.symbol ?? ''} L${e.line}`,
        value: String(i),
        picked: i === follow.trail.index,
      }));
      const value = await deps.pick()(entries, 'LogicLens: Trail');
      return value === undefined ? false : follow.go(Number(value));
    }),
    vscode.commands.registerCommand('logiclens.clearTrail', () => follow.clear()),
  ];
}
