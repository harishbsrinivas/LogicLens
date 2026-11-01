// Provider registry (arch §4, spec §6): detection in parallel with a timeout, a short cache,
// `auto` resolution in preference order, and change events. No vscode imports; settings and
// timers are injected so it is unit tested.
import type { ModelInfo, Provider, ProviderChoice, ProviderState, Resolution } from './types';

export const DETECT_TIMEOUT_MS = 3000;
export const DETECT_CACHE_MS = 60_000;

export interface ProviderStatus {
  provider: Provider;
  state: ProviderState;
}

export interface RegistryDeps {
  /** Adapters in spec §6 preference order. */
  providers: readonly Provider[];
  /** `logiclens.provider` and `logiclens.model`. */
  settings(): { provider: string; model: string };
  now?(): number;
}

export class ProviderRegistry {
  private providers: readonly Provider[];
  private cache: { at: number; statuses: ProviderStatus[] } | undefined;
  private pending: Promise<ProviderStatus[]> | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: RegistryDeps) {
    this.providers = deps.providers;
  }

  get all(): readonly Provider[] {
    return this.providers;
  }

  /** Test seam: replaces the adapters and forgets cached states. */
  setProviders(providers: readonly Provider[]): void {
    this.providers = providers;
    this.invalidate();
  }

  onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  /** Call when settings, installed extensions, or models change. */
  invalidate(): void {
    this.cache = undefined;
    this.pending = undefined;
    this.listeners.forEach((l) => l());
  }

  /** Every adapter's state; cached for a minute unless `force`. Never sends code. */
  async detectAll(force = false): Promise<ProviderStatus[]> {
    const now = this.now();
    if (!force && this.cache && now - this.cache.at < DETECT_CACHE_MS) {
      return this.cache.statuses;
    }
    if (!force && this.pending) {
      return this.pending;
    }
    const providers = this.providers;
    const pending = Promise.all(
      providers.map(async (provider) => ({ provider, state: await detectWithTimeout(provider) })),
    );
    this.pending = pending;
    const statuses = await pending;
    if (this.pending === pending) {
      this.pending = undefined;
      this.cache = { at: this.now(), statuses };
    }
    return statuses;
  }

  /** The provider and model a request uses. Never switches away from an explicit choice. */
  async resolve(choice: ProviderChoice = {}): Promise<Resolution> {
    const settings = this.deps.settings();
    const providerId = choice.provider || settings.provider || 'auto';
    // A model setting belongs to the configured provider; an override brings its own model.
    const model = choice.provider ? (choice.model ?? '') : choice.model || settings.model;
    const statuses = await this.detectAll();
    return resolveFrom(statuses, providerId, model);
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }
}

/** Resolution rules (spec §6). Pure. */
export function resolveFrom(
  statuses: readonly ProviderStatus[],
  providerId: string,
  modelId: string,
): Resolution {
  if (providerId === 'auto') {
    const ready = statuses.find((s) => s.state.kind === 'ready');
    if (!ready || ready.state.kind !== 'ready') {
      // With one provider its own reason says more than a generic message.
      const only = statuses.length === 1 ? statuses[0]?.state : undefined;
      return {
        kind: 'unavailable',
        reason:
          only && only.kind !== 'ready'
            ? only.reason
            : 'No AI provider is ready. Choose a provider to see how to set one up.',
      };
    }
    return pickModel(ready.provider, ready.state.models, modelId);
  }
  const status = statuses.find((s) => s.provider.id === providerId);
  if (!status) {
    return {
      kind: 'unavailable',
      reason: `The AI provider "${providerId}" is not available in this version of LogicLens. Choose another provider.`,
      providerId,
    };
  }
  if (status.state.kind !== 'ready') {
    return { kind: 'unavailable', reason: status.state.reason, providerId };
  }
  return pickModel(status.provider, status.state.models, modelId);
}

function pickModel(provider: Provider, models: readonly ModelInfo[], modelId: string): Resolution {
  const model = modelId ? models.find((m) => m.id === modelId) : models[0];
  if (!model) {
    return {
      kind: 'unavailable',
      reason: modelId
        ? `The model "${modelId}" is not available from ${provider.label}. Choose another model.`
        : `${provider.label} has no models available.`,
      providerId: provider.id,
    };
  }
  return { kind: 'ready', provider, model };
}

async function detectWithTimeout(provider: Provider): Promise<ProviderState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProviderState>((resolve) => {
    timer = setTimeout(
      () => resolve({ kind: 'unavailable', reason: `${provider.label} did not respond in time.` }),
      DETECT_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      provider.detect().catch((err: unknown): ProviderState => ({
        kind: 'unavailable',
        reason: `${provider.label} could not be checked: ${err instanceof Error ? err.message : String(err)}`,
      })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
