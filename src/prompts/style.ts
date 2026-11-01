// Depth, audience, jargon, and explanation language (spec §4) as prompt rules. Pure. Changing
// the text bumps the walkthrough and question prompt versions (arch §5.4).

export type Depth = 'overview' | 'standard' | 'detailed';
export type Audience = 'eli5' | 'newcomer' | 'practitioner' | 'expert';
export type Jargon = 'auto' | 'avoid' | 'define' | 'use';

export const DEPTHS: readonly Depth[] = ['overview', 'standard', 'detailed'];
export const AUDIENCES: readonly Audience[] = ['eli5', 'newcomer', 'practitioner', 'expert'];
export const JARGONS: readonly Jargon[] = ['auto', 'avoid', 'define', 'use'];

export interface ExplanationStyle {
  depth: Depth;
  audience: Audience;
  jargon: Jargon;
  /** BCP 47 tag; `auto` is resolved to the editor's display language before this point. */
  language: string;
}

export const DEFAULT_STYLE: ExplanationStyle = {
  depth: 'standard',
  audience: 'practitioner',
  jargon: 'auto',
  language: 'en',
};

/** Step count range per depth (spec §4); the eval checks walkthroughs fall inside it. */
export const STEP_RANGE: Record<Depth, [number, number]> = {
  overview: [3, 5],
  standard: [3, 15],
  detailed: [8, 25],
};

const DEPTH_RULES: Record<Depth, string> = {
  overview:
    'Depth: overview. Give the big picture in 3 to 5 steps, each covering a large block. Skip line-level detail.',
  standard: 'Depth: standard. Use 3 to 15 steps.',
  detailed:
    'Depth: detailed. Use 8 to 25 steps with small ranges, going line by line through dense code. Explain each non-obvious expression.',
};

const AUDIENCE_RULES: Record<Audience, string> = {
  eli5: "Audience: explain like I'm five. Use everyday words and short sentences. Give one concrete everyday analogy per step, then say plainly what the code actually does; the analogy never replaces it. Stay accurate.",
  newcomer:
    'Audience: a newcomer to this language. Name each concept and explain it briefly the first time it appears.',
  practitioner:
    'Audience: a working developer who knows the language. Explain framework and project specifics, not language basics.',
  expert:
    'Audience: an expert. Be terse. Focus on intent, invariants, edge cases, and performance.',
};

/** `auto` follows the audience (spec §4). */
export function effectiveJargon(
  style: Pick<ExplanationStyle, 'audience' | 'jargon'>,
): Exclude<Jargon, 'auto'> {
  if (style.jargon !== 'auto') {
    return style.jargon;
  }
  return style.audience === 'eli5' ? 'avoid' : style.audience === 'newcomer' ? 'define' : 'use';
}

const JARGON_RULES: Record<Exclude<Jargon, 'auto'>, string> = {
  avoid:
    'Jargon: avoid technical terms. Describe the idea in plain words instead of naming the term.',
  define:
    'Jargon: use technical terms, and add a short inline definition the first time each one appears.',
  use: 'Jargon: use technical terms freely without defining them.',
};

/** Style rules for a walkthrough; questions leave out depth. */
export function styleRules(style: ExplanationStyle, withDepth: boolean): string[] {
  const rules = [AUDIENCE_RULES[style.audience], JARGON_RULES[effectiveJargon(style)]];
  if (withDepth) {
    rules.unshift(DEPTH_RULES[style.depth]);
  }
  rules.push(
    `Language: write all explanation text in the language with BCP 47 tag "${style.language}". Keep code identifiers, tag lines, and line ranges exactly as they are; never translate them.`,
  );
  return rules.map((r) => `- ${r}`);
}

export const DEPTH_LABELS: Record<Depth, string> = {
  overview: 'Overview',
  standard: 'Standard',
  detailed: 'Detailed',
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  eli5: "Explain like I'm five",
  newcomer: 'Newcomer',
  practitioner: 'Practitioner',
  expert: 'Expert',
};

export const JARGON_LABELS: Record<Jargon, string> = {
  auto: 'Auto (follows audience)',
  avoid: 'Avoid',
  define: 'Define',
  use: 'Use',
};
