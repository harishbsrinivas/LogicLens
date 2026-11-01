// User prompts the gate needs. An interface so tests can answer them (arch §9).

export type TermsChoice = 'agree' | 'view' | 'cancel';
export type NoticeChoice = 'continue' | 'view' | 'cancel';

export interface Prompter {
  terms(): Promise<TermsChoice>;
  openTerms(): Promise<void>;
  dataNotice(providerLabel: string): Promise<NoticeChoice>;
  openUrl(url: string): Promise<void>;
  /** Modal yes/no; resolves true only when the user picks `action`. */
  confirm(message: string, action: string): Promise<boolean>;
}

/** Subset of `vscode.Memento` the gate uses. */
export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}
