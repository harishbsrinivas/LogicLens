// Provider commands (spec §6, §9): pick provider and model, reset data notices, regenerate a
// walkthrough with another provider, and the first-run choice. Settings hold the choice.
import * as vscode from 'vscode';
import type { ExplainOptions } from '../explain/walkthrough';
import type { KeyValueStore } from '../guard/prompter';
import type { ProviderRegistry } from '../providers/registry';
import type { ProviderChoice, Resolution } from '../providers/types';
import { modelEntries, providerEntries, type PickerEntry } from '../ui/providerPicker';
import { threadUri } from './steps';

/** Set once the user has picked, or LogicLens told them which provider it uses. */
export const PROVIDER_CHOSEN_KEY = 'providerChosen';

/** Shows a quick pick; swapped in tests. Resolves the picked entry's value. */
export type PickFn = (entries: PickerEntry[], title: string) => Thenable<string | undefined>;

export const showPick: PickFn = async (entries, title) => {
  const items = entries.map((e): vscode.QuickPickItem & { value?: string } =>
    e.kind === 'separator'
      ? { label: e.label, kind: vscode.QuickPickItemKind.Separator }
      : {
          label: e.label,
          description: e.picked ? `${e.description} · current` : e.description,
          detail: e.detail,
          value: e.value,
        },
  );
  const picked = await vscode.window.showQuickPick(items, { title, matchOnDescription: true });
  return picked?.value;
};

export interface ProviderCommandDeps {
  registry: ProviderRegistry;
  state: KeyValueStore & { keys(): readonly string[] };
  pick(): PickFn;
  /** Runs Explain File for the thread's document with options (Regenerate with…). */
  explain(options: ExplainOptions, arg?: unknown): Thenable<unknown>;
}

export function registerProviderCommands(deps: ProviderCommandDeps): vscode.Disposable[] {
  const { registry } = deps;
  const config = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration('logiclens');

  async function save(provider: string, model: string): Promise<void> {
    await config().update('provider', provider, vscode.ConfigurationTarget.Global);
    await config().update('model', model, vscode.ConfigurationTarget.Global);
    await deps.state.update(PROVIDER_CHOSEN_KEY, true);
    registry.invalidate();
  }

  async function runSetup(providerId: string): Promise<void> {
    const setup = registry.all.find((p) => p.id === providerId)?.setup;
    if (setup?.extensionId) {
      await vscode.commands.executeCommand(
        'workbench.extensions.search',
        `@id:${setup.extensionId}`,
      );
    } else if (setup?.url) {
      await vscode.env.openExternal(vscode.Uri.parse(setup.url));
    }
  }

  /** Provider, then model. Returns what was saved, or undefined when dismissed. */
  async function selectProvider(): Promise<ProviderChoice | undefined> {
    const statuses = await registry.detectAll(true);
    const current = config().get<string>('provider', 'auto') || 'auto';
    const value = await deps.pick()(providerEntries(statuses, current), 'LogicLens: AI Provider');
    if (value === undefined) {
      return undefined;
    }
    if (value.startsWith('setup:')) {
      await runSetup(value.slice('setup:'.length));
      return undefined;
    }
    if (value === 'auto') {
      await save('auto', '');
      return { provider: 'auto', model: '' };
    }
    const model = await selectModelFor(value);
    if (model === undefined) {
      return undefined;
    }
    await save(value, model);
    return { provider: value, model };
  }

  async function selectModelFor(providerId: string): Promise<string | undefined> {
    const status = (await registry.detectAll()).find((s) => s.provider.id === providerId);
    if (status?.state.kind !== 'ready') {
      return undefined;
    }
    const current =
      config().get<string>('provider') === providerId ? config().get<string>('model', '') : '';
    return deps.pick()(
      modelEntries(status.state.models, current ?? ''),
      `LogicLens: ${status.provider.label} model`,
    );
  }

  return [
    vscode.commands.registerCommand('logiclens.selectProvider', selectProvider),
    vscode.commands.registerCommand('logiclens.selectModel', async () => {
      const resolution = await registry.resolve();
      if (resolution.kind !== 'ready') {
        return selectProvider();
      }
      const model = await selectModelFor(resolution.provider.id);
      if (model !== undefined) {
        await save(resolution.provider.id, model);
      }
      return model;
    }),
    vscode.commands.registerCommand('logiclens.resetDataNotices', async () => {
      for (const key of deps.state.keys().filter((k) => k.startsWith('dataNotice.'))) {
        await deps.state.update(key, undefined);
      }
      void vscode.window.showInformationMessage(
        'LogicLens will show the data notice again before the next request to each provider.',
      );
    }),
    // Overview thread title: one request with another provider; settings stay as they are.
    vscode.commands.registerCommand('logiclens.regenerateWith', async (arg?: unknown) => {
      const statuses = (await registry.detectAll(true)).filter((s) => s.state.kind === 'ready');
      const entries: PickerEntry[] = statuses.flatMap(({ provider, state }) =>
        state.kind === 'ready'
          ? state.models.map((m): PickerEntry => ({
              kind: 'item',
              label: m.label,
              description: provider.label,
              value: JSON.stringify([provider.id, m.id]),
              picked: false,
            }))
          : [],
      );
      if (entries.length === 0) {
        void vscode.window.showWarningMessage('No AI provider is ready.');
        return undefined;
      }
      const value = await deps.pick()(entries, 'LogicLens: Regenerate with…');
      if (!value) {
        return undefined;
      }
      const [provider, model] = JSON.parse(value) as [string, string];
      const uri = threadUri(arg);
      return deps.explain({ provider: { provider, model } }, uri ? { uri } : undefined);
    }),
  ];
}

/**
 * First run (spec §6): with `auto` and no choice yet, one Ready provider is used and named in a
 * notification; several Ready providers open the picker before anything is sent.
 */
export function createResolver(
  registry: ProviderRegistry,
  state: KeyValueStore,
  choose: () => Thenable<ProviderChoice | undefined>,
): (choice?: ProviderChoice) => Promise<Resolution> {
  return async (choice) => {
    const configured = vscode.workspace
      .getConfiguration('logiclens')
      .get<string>('provider', 'auto');
    if (!choice?.provider && (configured || 'auto') === 'auto' && !state.get(PROVIDER_CHOSEN_KEY)) {
      const ready = (await registry.detectAll()).filter((s) => s.state.kind === 'ready');
      if (ready.length === 1 && ready[0]) {
        await state.update(PROVIDER_CHOSEN_KEY, true);
        void vscode.window.showInformationMessage(
          `LogicLens is using ${ready[0].provider.label}. Click LogicLens in the status bar to change it.`,
        );
      } else if (ready.length > 1 && !(await choose())) {
        return { kind: 'unavailable', reason: 'Choose an AI provider to continue.' };
      }
    }
    return registry.resolve(choice);
  };
}
