import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTIONS, SETTINGS, validateSetting } from '../../src/settings/schema';

interface Contributed {
  type: string;
  enum?: string[];
  scope?: string;
  minimum?: number;
}

const contributed = (
  JSON.parse(readFileSync('package.json', 'utf8')) as {
    contributes: { configuration: { properties: Record<string, Contributed> } };
  }
).contributes.configuration.properties;

describe('settings page schema', () => {
  it('matches package.json for every setting it edits: type, choices, scope, minimum', () => {
    for (const s of SETTINGS) {
      const c = contributed[`logiclens.${s.key}`];
      expect(c, s.key).toBeDefined();
      const type = s.type === 'enum' ? 'string' : s.type === 'string[]' ? 'array' : s.type;
      expect(c?.type, s.key).toBe(type);
      expect(c?.scope ?? 'resource', s.key).toBe(s.scope);
      expect(c?.enum, s.key).toEqual(s.options?.map((o) => o.value));
      expect(c?.minimum, s.key).toEqual(s.min);
    }
  });

  it('covers every contributed setting, and every section is used', () => {
    expect(Object.keys(contributed).sort()).toEqual(
      SETTINGS.map((s) => `logiclens.${s.key}`).sort(),
    );
    for (const section of SECTIONS) {
      expect(
        SETTINGS.some((s) => s.section === section.id),
        section.id,
      ).toBe(true);
    }
  });

  it('accepts valid values and normalizes text and lists', () => {
    expect(validateSetting('depth', 'detailed')).toMatchObject({ ok: true, value: 'detailed' });
    expect(validateSetting('focusDimming', false)).toMatchObject({ ok: true, value: false });
    expect(validateSetting('maxLines', 500)).toMatchObject({ ok: true, value: 500 });
    expect(validateSetting('explanationLanguage', ' pt-BR ')).toMatchObject({
      ok: true,
      value: 'pt-BR',
    });
    expect(validateSetting('exclude', [' **/.env* ', '', '**/.env*', '*.pem'])).toMatchObject({
      ok: true,
      value: ['**/.env*', '*.pem'],
    });
  });

  it('rejects unknown keys, wrong types, values outside the choices, and odd text', () => {
    expect(validateSetting('debug.secret', true)).toMatchObject({ ok: false });
    expect(validateSetting('__proto__', {})).toMatchObject({ ok: false });
    expect(validateSetting('depth', 'everything')).toMatchObject({ ok: false });
    expect(validateSetting('focusDimming', 'yes')).toMatchObject({ ok: false });
    expect(validateSetting('maxLines', 0)).toMatchObject({ ok: false });
    expect(validateSetting('maxLines', 1.5)).toMatchObject({ ok: false });
    expect(validateSetting('cli.timeoutSeconds', 5)).toMatchObject({ ok: false });
    expect(validateSetting('explanationLanguage', 'english please')).toMatchObject({ ok: false });
    expect(validateSetting('cli.claudePath', '/bin/claude\n--evil')).toMatchObject({ ok: false });
    expect(validateSetting('exclude', 'not a list')).toMatchObject({ ok: false });
  });
});
