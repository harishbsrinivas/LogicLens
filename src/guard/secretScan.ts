// Deterministic local secret scan (ADR-0020, arch §8). Pure: no vscode imports, no model.

export interface Flagged {
  /** 1-based line number. */
  line: number;
  /** Pattern name only; the matched value never leaves this module. */
  pattern: string;
}

interface TokenPattern {
  name: string;
  re: RegExp;
  /** Index of the capture group holding the secret value, checked against placeholders. */
  valueGroup?: number;
}

const TOKEN_PATTERNS: TokenPattern[] = [
  { name: 'aws-access-key-id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'github-fine-grained-token', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { name: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'stripe-live-key', re: /\b[sr]k_live_[A-Za-z0-9]{16,}/g },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}/g },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  {
    name: 'credential-url',
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:([^\s@'"`]+)@/gi,
    valueGroup: 1,
  },
];

const ASSIGNMENT =
  /([A-Za-z0-9_.-]*(?:key|secret|token|passw(?:or)?d|credential|auth)[A-Za-z0-9_.-]*)["']?\s*(?:=>|=|:)\s*(["'`])([^"'`\s]{16,})\2/gi;

const PEM_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PEM_END = /-----END [A-Z ]*PRIVATE KEY-----/;

/** Initial threshold from arch §8, tuned on the fixtures in test/unit/secretScan.test.ts. */
export const ENTROPY_THRESHOLD = 3.5;

/** Documented example values that are safe to send. */
const KNOWN_EXAMPLES = ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'];

export function isPlaceholder(value: string): boolean {
  if (KNOWN_EXAMPLES.includes(value)) {
    return true;
  }
  return (
    /^<[^>]*>$/.test(value) ||
    /\$\{[^}]*\}/.test(value) ||
    /\{\{[^}]*\}\}/.test(value) ||
    // Mostly x or * ("sk-xxxxxxxx…", "********"): a mask, not a value.
    (value.match(/[xX*]/g)?.length ?? 0) * 2 >= value.length ||
    /changeme|example|dummy|placeholder|your[-_]|redacted/i.test(value)
  );
}

export function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Returns the first pattern name that flags this single line, if any. */
function scanLine(line: string): string | undefined {
  for (const p of TOKEN_PATTERNS) {
    p.re.lastIndex = 0;
    for (const m of line.matchAll(p.re)) {
      const value = p.valueGroup !== undefined ? (m[p.valueGroup] ?? '') : m[0];
      if (!isPlaceholder(value)) {
        return p.name;
      }
    }
  }
  for (const m of line.matchAll(ASSIGNMENT)) {
    const value = m[3] ?? '';
    if (!isPlaceholder(value) && shannonEntropy(value) > ENTROPY_THRESHOLD) {
      return 'keyword-assignment';
    }
  }
  return undefined;
}

export function scan(lines: readonly string[], firstLine = 1): { flagged: Flagged[] } {
  const flagged: Flagged[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (PEM_BEGIN.test(line)) {
      // Flag the whole block; an unterminated block runs to the end of the text.
      let j = i;
      while (j < lines.length) {
        flagged.push({ line: firstLine + j, pattern: 'private-key-block' });
        if (PEM_END.test(lines[j] ?? '')) {
          break;
        }
        j++;
      }
      i = j;
      continue;
    }
    const pattern = scanLine(line);
    if (pattern) {
      flagged.push({ line: firstLine + i, pattern });
    }
  }
  return { flagged };
}

/** Replaces token-shaped values with a marker, for logs (arch §8). */
export function redact(text: string): string {
  let out = text;
  for (const p of TOKEN_PATTERNS) {
    out = out.replace(p.re, '[redacted]');
  }
  return out
    .replace(ASSIGNMENT, (_m, name: string, q: string) => `${name}=${q}[redacted]${q}`)
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
      '[redacted private key]',
    );
}

/** Replaces a withheld line in outgoing text; the line keeps its number (spec §8). */
export const WITHHELD_MARKER = '«line withheld by LogicLens: possible secret»';
