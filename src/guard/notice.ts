// One-time data notice per provider (spec §8). S1 has one provider; per-provider wording in S5.
import type { KeyValueStore, Prompter } from './prompter';

export function noticeKey(providerId: string): string {
  return `dataNotice.${providerId}`;
}

export async function ensureNotice(
  store: KeyValueStore,
  prompter: Prompter,
  provider: { id: string; label: string; termsUrl: string },
): Promise<boolean> {
  if (store.get<string>(noticeKey(provider.id))) {
    return true;
  }
  const choice = await prompter.dataNotice(provider.label);
  if (choice === 'continue') {
    await store.update(noticeKey(provider.id), new Date().toISOString());
    return true;
  }
  if (choice === 'view') {
    await prompter.openUrl(provider.termsUrl);
  }
  return false;
}
