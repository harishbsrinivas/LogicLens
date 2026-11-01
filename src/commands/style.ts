// Depth, audience, and jargon commands (spec §4, §9). Each saves the setting and, when the
// document has a walkthrough, offers to regenerate it with the new value.
import * as vscode from 'vscode';
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  DEPTH_LABELS,
  DEPTHS,
  JARGON_LABELS,
  JARGONS,
} from '../prompts/style';
import { SessionStore } from '../state/session';
import type { ActiveEditor } from '../ui/activeEditor';
import type { PickerEntry } from '../ui/providerPicker';
import type { PickFn } from './provider';
import { threadUri } from './steps';

export interface StyleCommandDeps {
  session: SessionStore;
  active: ActiveEditor;
  pick(): PickFn;
  confirm(message: string, action: string): Promise<boolean>;
}

interface StyleSetting {
  command: string;
  key: 'depth' | 'audience' | 'jargon';
  title: string;
  values: readonly string[];
  labels: Record<string, string>;
}

const SETTINGS: StyleSetting[] = [
  {
    command: 'logiclens.setDepth',
    key: 'depth',
    title: 'Explanation depth',
    values: DEPTHS,
    labels: DEPTH_LABELS,
  },
  {
    command: 'logiclens.setAudience',
    key: 'audience',
    title: 'Audience',
    values: AUDIENCES,
    labels: AUDIENCE_LABELS,
  },
  {
    command: 'logiclens.setJargon',
    key: 'jargon',
    title: 'Jargon',
    values: JARGONS,
    labels: JARGON_LABELS,
  },
];

/** Saves where the value currently comes from, so a workspace value is not silently shadowed. */
async function save(uri: vscode.Uri | undefined, key: string, value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('logiclens', uri);
  const info = config.inspect(key);
  const target =
    info?.workspaceFolderValue !== undefined
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : info?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
  await config.update(key, value, target);
}

export function registerStyleCommands(deps: StyleCommandDeps): vscode.Disposable[] {
  const { session, active } = deps;

  async function set(setting: StyleSetting, arg: unknown): Promise<string | undefined> {
    const uri = threadUri(arg) ?? active.editor?.document.uri;
    const current = vscode.workspace.getConfiguration('logiclens', uri).get<string>(setting.key);
    const entries = setting.values.map((v): PickerEntry => ({
      kind: 'item',
      label: setting.labels[v] ?? v,
      description: v,
      value: v,
      picked: v === current,
    }));
    const value = await deps.pick()(entries, `LogicLens: ${setting.title}`);
    if (value === undefined || !setting.values.includes(value)) {
      return undefined;
    }
    await save(uri, setting.key, value);
    const entry = uri && session.get(SessionStore.key(uri));
    if (
      uri &&
      entry &&
      !entry.cancel &&
      (await deps.confirm(
        `Regenerate this explanation with ${setting.title.toLowerCase()} "${setting.labels[value] ?? value}"?`,
        'Regenerate',
      ))
    ) {
      // Passing the thread-like { uri } keeps the walkthrough's selection or symbol.
      await vscode.commands.executeCommand('logiclens.explainFile', { uri });
    }
    return value;
  }

  return [
    ...SETTINGS.map((s) =>
      vscode.commands.registerCommand(s.command, (arg?: unknown) => set(s, arg)),
    ),
    // One title action on the explanation thread instead of three (arch §6).
    vscode.commands.registerCommand('logiclens.adjustExplanation', async (arg?: unknown) => {
      const value = await deps.pick()(
        [
          ...SETTINGS.map((s): PickerEntry => ({
            kind: 'item',
            label: s.title,
            description: '',
            value: s.command,
            picked: false,
          })),
          {
            kind: 'item',
            label: 'All LogicLens settings…',
            description: '',
            value: 'settings',
            picked: false,
          },
        ],
        'LogicLens: Adjust Explanation',
      );
      if (value === 'settings') {
        return vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:logiclens-dev.logiclens',
        );
      }
      return value ? vscode.commands.executeCommand(value, arg) : undefined;
    }),
  ];
}
