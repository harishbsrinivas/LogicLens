import { describe, expect, it } from 'vitest';
import { HELLO_MESSAGE } from '../../shared/messages';

describe('shared messages', () => {
  it('exposes the hello text', () => {
    expect(HELLO_MESSAGE).toBe('Hello from LogicLens');
  });
});
