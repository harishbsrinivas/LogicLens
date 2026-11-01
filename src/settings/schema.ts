// Settings the settings page can edit (spec §16, ADR-0031). Pure. Every entry mirrors
// package.json `contributes.configuration` (a unit test checks they agree); the page can set
// nothing else, and each value is validated here before it is written.

export type SettingType = 'boolean' | 'number' | 'string' | 'enum' | 'string[]';
export type SettingScope = 'application' | 'machine' | 'resource';

export interface SettingSpec {
  key: string;
  section: SectionId;
  label: string;
  type: SettingType;
  scope: SettingScope;
  /** Allowed values and their labels, for `enum`. */
  options?: readonly { value: string; label: string }[];
  min?: number;
  /** Extra checks for strings, for example a BCP 47 tag. */
  pattern?: RegExp;
  help: string;
}

export type SectionId =
  'provider' | 'explanations' | 'privacy' | 'display' | 'cache' | 'cli' | 'debug';

export const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'provider', title: 'AI provider' },
  { id: 'explanations', title: 'Explanations' },
  { id: 'privacy', title: 'Privacy and limits' },
  { id: 'display', title: 'Display' },
  { id: 'cache', title: 'Saved explanations' },
  { id: 'cli', title: 'Command-line providers' },
  { id: 'debug', title: 'Troubleshooting' },
];

const opts = (...pairs: [string, string][]): { value: string; label: string }[] =>
  pairs.map(([value, label]) => ({ value, label }));

export const SETTINGS: readonly SettingSpec[] = [
  {
    key: 'provider',
    section: 'provider',
    label: 'Provider',
    type: 'enum',
    scope: 'application',
    options: opts(
      ['auto', 'Auto (first ready)'],
      ['vscode-lm', 'VS Code language models (Copilot)'],
      ['claude-code', 'Claude Code'],
    ),
    help: 'Which AI tool LogicLens sends code to. LogicLens never switches on its own.',
  },
  {
    key: 'model',
    section: 'provider',
    label: 'Model',
    type: 'string',
    scope: 'application',
    help: "Empty uses the provider's default model.",
  },
  {
    key: 'depth',
    section: 'explanations',
    label: 'Depth',
    type: 'enum',
    scope: 'resource',
    options: opts(
      ['overview', 'Overview (3–5 steps)'],
      ['standard', 'Standard (3–15 steps)'],
      ['detailed', 'Detailed (8–25 steps)'],
    ),
    help: 'How many steps a walkthrough has and how much detail each gives.',
  },
  {
    key: 'audience',
    section: 'explanations',
    label: 'Audience',
    type: 'enum',
    scope: 'resource',
    options: opts(
      ['eli5', "Explain like I'm five"],
      ['newcomer', 'Newcomer'],
      ['practitioner', 'Practitioner'],
      ['expert', 'Expert'],
    ),
    help: 'Who the explanation is written for. Answers follow it too.',
  },
  {
    key: 'jargon',
    section: 'explanations',
    label: 'Jargon',
    type: 'enum',
    scope: 'resource',
    options: opts(
      ['auto', 'Auto (follows audience)'],
      ['avoid', 'Avoid'],
      ['define', 'Define'],
      ['use', 'Use'],
    ),
    help: 'How technical terms are handled.',
  },
  {
    key: 'explanationLanguage',
    section: 'explanations',
    label: 'Explanation language',
    type: 'string',
    scope: 'application',
    pattern: /^(auto|[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/,
    help: "A BCP 47 tag such as de or pt-BR, or auto for VS Code's display language.",
  },
  {
    key: 'secrets.action',
    section: 'privacy',
    label: 'When a possible secret is found',
    type: 'enum',
    scope: 'application',
    options: opts(
      ['skip-lines', 'Withhold those lines and send the rest'],
      ['refuse-file', 'Send nothing'],
    ),
    help: 'The local secret scan always runs; it cannot be turned off.',
  },
  {
    key: 'exclude',
    section: 'privacy',
    label: 'Never read or send files matching',
    type: 'string[]',
    scope: 'resource',
    help: 'Glob patterns, one per line. Workspace settings can add patterns but never remove these.',
  },
  {
    key: 'maxLines',
    section: 'privacy',
    label: 'Largest file sent whole (lines)',
    type: 'number',
    scope: 'resource',
    min: 1,
    help: 'Above this, LogicLens offers the selection, visible range, or a symbol.',
  },
  {
    key: 'focusDimming',
    section: 'display',
    label: 'Dim lines outside the focused step',
    type: 'boolean',
    scope: 'application',
    help: '',
  },
  {
    key: 'followCursor',
    section: 'display',
    label: 'Move the highlight to the step under the cursor',
    type: 'boolean',
    scope: 'application',
    help: '',
  },
  {
    key: 'codeLens.enabled',
    section: 'display',
    label: 'Show "Explain" above functions and classes',
    type: 'boolean',
    scope: 'application',
    help: '',
  },
  {
    key: 'cache.enabled',
    section: 'cache',
    label: 'Keep walkthroughs and threads between sessions',
    type: 'boolean',
    scope: 'application',
    help: "Stored in VS Code's extension storage on this machine, never in your workspace.",
  },
  {
    key: 'cli.claudePath',
    section: 'cli',
    label: 'Path to claude',
    type: 'string',
    scope: 'machine',
    help: 'Empty uses claude on PATH. Workspace settings cannot change this.',
  },
  {
    key: 'cli.timeoutSeconds',
    section: 'cli',
    label: 'Stop a CLI request after (seconds)',
    type: 'number',
    scope: 'application',
    min: 10,
    help: '',
  },
  {
    key: 'debug.logPrompts',
    section: 'debug',
    label: 'Log prompts and responses to the LogicLens output channel',
    type: 'boolean',
    scope: 'application',
    help: 'Secrets are redacted, but your code and the answers are written to the log. Off by default.',
  },
];

export type SettingValue = boolean | number | string | string[];

/** Validates a value from the settings page. Returns the value to write, or an error. Pure. */
export function validateSetting(
  key: unknown,
  value: unknown,
): { ok: true; spec: SettingSpec; value: SettingValue } | { ok: false; error: string } {
  const spec = SETTINGS.find((s) => s.key === key);
  if (!spec) {
    return { ok: false, error: 'Unknown setting.' };
  }
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? { ok: true, spec, value }
        : { ok: false, error: 'Expected on or off.' };
    case 'number':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= (spec.min ?? 0)
        ? { ok: true, spec, value }
        : { ok: false, error: `Expected a whole number of at least ${spec.min ?? 0}.` };
    case 'enum':
      return typeof value === 'string' && spec.options?.some((o) => o.value === value)
        ? { ok: true, spec, value }
        : { ok: false, error: 'Not one of the choices.' };
    case 'string': {
      if (typeof value !== 'string' || value.length > 1024 || /[\0\r\n]/.test(value)) {
        return { ok: false, error: 'Expected one line of text.' };
      }
      const text = value.trim();
      return spec.pattern && text && !spec.pattern.test(text)
        ? { ok: false, error: 'Not a valid value.' }
        : { ok: true, spec, value: text };
    }
    case 'string[]': {
      if (
        !Array.isArray(value) ||
        value.length > 200 ||
        !value.every((v) => typeof v === 'string' && v.length <= 512)
      ) {
        return { ok: false, error: 'Expected a list of patterns.' };
      }
      const list = [...new Set((value as string[]).map((v) => v.trim()).filter(Boolean))];
      return { ok: true, spec, value: list };
    }
  }
}
