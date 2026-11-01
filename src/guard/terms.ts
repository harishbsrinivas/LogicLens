// Terms of use acceptance (ADR-0024). Must match the **Version:** line in TERMS.md.
import type { KeyValueStore, Prompter } from './prompter';

export const TERMS_VERSION = '2026-11-01';
export const TERMS_KEY = 'termsAccepted';

interface Accepted {
  version: string;
  acceptedAt: string;
}

export function termsAccepted(store: KeyValueStore): boolean {
  return store.get<Accepted>(TERMS_KEY)?.version === TERMS_VERSION;
}

/** Shows the terms modal when needed. Only "I Agree" records acceptance. */
export async function ensureTerms(store: KeyValueStore, prompter: Prompter): Promise<boolean> {
  if (termsAccepted(store)) {
    return true;
  }
  const choice = await prompter.terms();
  if (choice === 'agree') {
    await store.update(TERMS_KEY, {
      version: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
    } satisfies Accepted);
    return true;
  }
  if (choice === 'view') {
    await prompter.openTerms();
  }
  return false;
}
