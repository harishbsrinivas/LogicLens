import { describe, expect, it } from 'vitest';
import { identifiersIn, Trail, TRAIL_CAP, type TrailEntry } from '../../src/nav/trail';

const e = (uri: string, line = 1): TrailEntry => ({
  uri,
  line,
  character: 0,
  scrollTop: 1,
  step: null,
});

describe('Trail', () => {
  it('records both ends of the first follow', () => {
    const t = new Trail();
    t.follow(e('a'), e('b'));
    expect(t.all().map((x) => x.uri)).toEqual(['a', 'b']);
    expect([t.index, t.canGoBack, t.canGoForward]).toEqual([1, true, false]);
  });

  it('goes back and forward, and a new follow drops forward entries', () => {
    const t = new Trail();
    t.follow(e('a'), e('b'));
    t.follow(e('b', 5), e('c'));
    expect(t.goTo(0)?.uri).toBe('a');
    expect(t.canGoForward).toBe(true);
    t.goTo(1);
    t.follow(e('b', 9), e('d'));
    expect(t.all().map((x) => `${x.uri}${x.line}`)).toEqual(['a1', 'b9', 'd1']);
  });

  it('caps at 30 entries, dropping the oldest', () => {
    const t = new Trail();
    for (let i = 0; i < 40; i++) {
      t.follow(e(`f${i}`), e(`f${i + 1}`));
    }
    expect(t.size).toBe(TRAIL_CAP);
    expect(t.all()[0]?.uri).toBe('f11');
    expect(t.index).toBe(TRAIL_CAP - 1);
  });

  it('serializes and restores, dropping malformed entries', () => {
    const t = new Trail();
    t.follow(e('a'), e('b'));
    const u = new Trail();
    u.restore({ ...t.serialize(), entries: [...t.serialize().entries, { uri: 3 }] });
    expect(u.all().map((x) => x.uri)).toEqual(['a', 'b']);
    u.restore('nonsense');
    expect(u.size).toBe(0);
  });

  it('removes a missing entry and keeps the index valid', () => {
    const t = new Trail();
    t.follow(e('a'), e('b'));
    t.follow(e('b'), e('c'));
    t.remove(1);
    expect(t.all().map((x) => x.uri)).toEqual(['a', 'c']);
    expect(t.at(t.index)?.uri).toBe('c');
    expect(t.goTo(7)).toBeUndefined();
  });
});

describe('identifiersIn', () => {
  it('lists identifiers once, skipping keywords, strings, and comments', () => {
    const lines = [
      'const user = await verifyUser(token, "ignored words");',
      'return decode(user); // comment words',
    ];
    expect(identifiersIn(lines, [{ start: 1, end: 2 }]).map((i) => i.name)).toEqual([
      'user',
      'verifyUser',
      'token',
      'decode',
    ]);
    expect(identifiersIn(lines, [{ start: 1, end: 1 }])[1]).toEqual({
      name: 'verifyUser',
      line: 1,
      character: 19,
    });
  });
});
