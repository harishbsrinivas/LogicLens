import { describe, expect, it } from 'vitest';
import {
  ENTROPY_THRESHOLD,
  isPlaceholder,
  redact,
  scan,
  shannonEntropy,
} from '../../src/guard/secretScan';
import { fake } from './helpers';

// One fixture per pattern. Values are assembled at runtime (see `fake`).
const FIXTURES: [string, string][] = [
  ['aws-access-key-id', `const id = '${fake('AKIA', 'Q7RT2MZX4LNB8VHC')}';`],
  ['github-token', `token: ${fake('ghp_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8')}`],
  ['github-fine-grained-token', `${fake('github_pat_', '11ABCDEFG0123456789_abcdefghijklmnop')}`],
  ['gitlab-token', `GL=${fake('glpat-', 'Zx9Yw8Vu7Ts6Rq5Po4Nm')}`],
  ['slack-token', `hook(${fake('xoxb-', '1234567890-abcdefghij')})`],
  ['stripe-live-key', `stripe(${fake('sk_live_', 'q8W3e9R4t0Y5u1I6')})`],
  ['google-api-key', `key=${fake('AIza', 'Sy3n8Kq2Lm9Pz4Xc7Vb1Nh6Jg5Df0Sa2Wq8E')}`],
  ['anthropic-key', `${fake('sk-ant-', 'api03-Qz8Xw7Vy6Ut5Sr4Pq3')}`],
  ['openai-key', `${fake('sk-proj-', 'Ab3Cd4Ef5Gh6Ij7Kl8Mn9Op')}`],
  [
    'jwt',
    `auth = ${fake('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')}`,
  ],
  ['credential-url', `DB = "postgres://admin:${fake('Hunter2', 'Pass')}@db.internal:5432/app"`],
  ['keyword-assignment', `const apiSecret = "${fake('q9T2vL8xN4', 'mR7cK1zW5b')}";`],
];

describe('secret scan', () => {
  it.each(FIXTURES)('flags %s', (pattern, line) => {
    expect(scan(['const ok = 1;', line])).toEqual({ flagged: [{ line: 2, pattern }] });
  });

  it('flags every line of a private key block, including BEGIN and END', () => {
    const lines = [
      'const pem = `',
      fake('-----BEGIN RSA ', 'PRIVATE KEY-----'),
      'MIIEowIBAAKCAQEAx',
      'abcdefghij',
      fake('-----END RSA ', 'PRIVATE KEY-----'),
      '`;',
    ];
    expect(scan(lines).flagged.map((f) => f.line)).toEqual([2, 3, 4, 5]);
  });

  it('runs an unterminated key block to the end', () => {
    const lines = ['x', fake('-----BEGIN ', 'PRIVATE KEY-----'), 'abc', 'def'];
    expect(scan(lines).flagged.map((f) => f.line)).toEqual([2, 3, 4]);
  });

  it('offsets line numbers', () => {
    expect(scan([FIXTURES[0]?.[1] ?? ''], 40).flagged[0]?.line).toBe(40);
  });

  it.each([
    ['AWS documentation example', "const id = 'AKIAIOSFODNN7EXAMPLE';"],
    ['angle placeholder', 'password: "<your-password-here>"'],
    ['template variable', 'const token = "${API_TOKEN_FROM_ENVIRONMENT}";'],
    ['masked value', `const key = "${fake('sk-', 'xxxxxxxxxxxxxxxxxxxxxxxx')}";`],
    ['changeme', 'secret = "changeme-changeme-changeme"'],
    ['low entropy', 'const password = "aaaaaaaaaaaaaaaaaaaa";'],
    ['short value', 'const token = "abc123";'],
  ])('does not flag %s', (_name, line) => {
    expect(scan([line]).flagged).toEqual([]);
  });

  // Ordinary code that mentions keys, tokens, and auth must pass (false-positive fixtures).
  it('does not flag normal code', () => {
    const code = [
      "import { getToken } from './auth';",
      'const tokenKey = config.get("auth.tokenKey");',
      'function validatePassword(password: string): boolean {',
      '  return password.length >= 12;',
      '}',
      'const keys = Object.keys(map);',
      'headers.Authorization = `Bearer ${token}`;',
      "const url = 'https://example.com/api/v1/users?page=2';",
      'const hash = sha256(secretInput);',
      "const ID = 'user-profile-settings-panel';",
      'export const AUTH_HEADER_NAME = "x-request-identifier";',
      "const route = 'postgres://localhost:5432/app';",
    ];
    expect(scan(code).flagged).toEqual([]);
  });

  it('has the documented threshold and entropy measure', () => {
    expect(ENTROPY_THRESHOLD).toBe(3.5);
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('abcd')).toBe(2);
  });

  it('recognizes placeholders', () => {
    expect(isPlaceholder('<token>')).toBe(true);
    expect(isPlaceholder('********')).toBe(true);
    expect(isPlaceholder('your_api_key_goes_here')).toBe(true);
    expect(isPlaceholder('q9T2vL8xN4mR7cK1zW5b')).toBe(false);
  });

  it('redacts token values for logs', () => {
    for (const [, line] of FIXTURES) {
      const out = redact(line);
      const value = line.match(/(AKIA\w+|ghp_\w+|github_pat_\w+|sk-\S+|eyJ\S+)/)?.[0];
      if (value) {
        expect(out).not.toContain(value);
      }
    }
    const key = fake('-----BEGIN ', 'PRIVATE KEY-----\nabc\n-----END ', 'PRIVATE KEY-----');
    expect(redact(`x ${key} y`)).toBe('x [redacted private key] y');
  });
});
