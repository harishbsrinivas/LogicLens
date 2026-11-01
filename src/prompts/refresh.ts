// Refresh changed steps (arch §5.9): rewrites only the steps whose code changed, in the same
// protocol, keyed by step number. Changing the text bumps the version (arch §5.4).
import { rangeText } from '../explain/context';
import type { StepView } from '../state/types';

export const REFRESH_VERSION = 1;

export function refreshUser(context: string, overview: string, steps: readonly StepView[]): string {
  return [
    'The code changed since you wrote a walkthrough of it. Rewrite only the steps listed below, for the current code.',
    'Use the same format with the same step numbers (for example "@@step 3 | L40-L52 | Title"), give each step its current line ranges, and finish with @@end.',
    'Do not write @@overview, @@summary, @@watch, or any step that is not listed.',
    '',
    'Your earlier overview:',
    overview.trim() || '(none)',
    '',
    'Steps to rewrite:',
    ...steps.map(
      (s) => `- Step ${s.index + 1} (was ${s.ranges.map(rangeText).join(', ')}): ${s.title}`,
    ),
    '',
    context,
  ].join('\n');
}
