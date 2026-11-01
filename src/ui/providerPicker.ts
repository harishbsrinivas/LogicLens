// Provider and model picker items (arch §6 "Quick picks", spec §6). Pure: no vscode imports, so
// grouping and wording are unit tested; commands/provider.ts turns them into QuickPickItems.
import type { ProviderStatus } from '../providers/registry';
import type { ModelInfo, ProviderState } from '../providers/types';

export type PickerEntry =
  | { kind: 'separator'; label: string }
  | {
      kind: 'item';
      label: string;
      description: string;
      detail?: string;
      /** `auto`, a provider id, or `setup:<provider id>`. */
      value: string;
      picked: boolean;
    };

const STATE_TEXT: Record<ProviderState['kind'], string> = {
  ready: 'Ready',
  'needs-sign-in': 'Needs sign-in',
  'not-installed': 'Not installed',
  unavailable: 'Unavailable',
};

export function stateText(state: ProviderState): string {
  return STATE_TEXT[state.kind];
}

/** Auto first, then Ready providers, then the others with their setup action. */
export function providerEntries(
  statuses: readonly ProviderStatus[],
  current: string,
): PickerEntry[] {
  const ready = statuses.filter((s) => s.state.kind === 'ready');
  const others = statuses.filter((s) => s.state.kind !== 'ready');
  const entries: PickerEntry[] = [
    {
      kind: 'item',
      label: '$(sparkle) Auto',
      description: ready[0] ? `uses ${ready[0].provider.label}` : 'no provider is ready',
      detail: 'The first ready provider, in LogicLens order.',
      value: 'auto',
      picked: current === 'auto',
    },
  ];
  if (ready.length > 0) {
    entries.push({ kind: 'separator', label: 'Ready' });
    for (const { provider, state } of ready) {
      const n = state.kind === 'ready' ? state.models.length : 0;
      entries.push({
        kind: 'item',
        label: `$(check) ${provider.label}`,
        description: `${n} ${n === 1 ? 'model' : 'models'}`,
        detail: provider.dataLeavesMachine ? undefined : 'Runs on this machine.',
        value: provider.id,
        picked: current === provider.id,
      });
    }
  }
  if (others.length > 0) {
    entries.push({ kind: 'separator', label: 'Not ready' });
    for (const { provider, state } of others) {
      const reason = state.kind === 'ready' ? '' : state.reason;
      entries.push({
        kind: 'item',
        label: `$(circle-slash) ${provider.label}`,
        description: stateText(state),
        detail: provider.setup ? `${reason} Pick to ${lower(provider.setup.label)}.` : reason,
        value: provider.setup ? `setup:${provider.id}` : provider.id,
        picked: false,
      });
    }
  }
  return entries;
}

export function modelEntries(models: readonly ModelInfo[], current: string): PickerEntry[] {
  return [
    {
      kind: 'item',
      label: 'Default',
      description: models[0] ? models[0].label : '',
      detail: "The provider's default model.",
      value: '',
      picked: current === '',
    },
    ...models.map((m): PickerEntry => ({
      kind: 'item',
      label: m.label,
      description: m.id,
      value: m.id,
      picked: current === m.id,
    })),
  ];
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
