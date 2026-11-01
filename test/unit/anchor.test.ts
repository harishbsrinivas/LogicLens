import { describe, expect, it } from 'vitest';
import { anchorRanges, measure } from '../../src/explain/anchor';

const TARGET = { start: 1, end: 100 };

describe('anchoring', () => {
  it('keeps ranges inside the target', () => {
    expect(anchorRanges([{ start: 10, end: 20 }], TARGET)).toEqual({
      ranges: [{ start: 10, end: 20 }],
      anchored: true,
    });
  });

  it('clamps ranges within 2 lines of the target', () => {
    expect(anchorRanges([{ start: 95, end: 102 }], TARGET).ranges).toEqual([
      { start: 95, end: 100 },
    ]);
    expect(anchorRanges([{ start: 9, end: 12 }], { start: 10, end: 50 }).ranges).toEqual([
      { start: 10, end: 12 },
    ]);
  });

  it('marks steps unanchored when every range is too far out', () => {
    expect(anchorRanges([{ start: 95, end: 103 }], TARGET)).toEqual({
      ranges: [],
      anchored: false,
    });
    expect(anchorRanges([], TARGET).anchored).toBe(false);
  });

  it('keeps the valid ranges of a multi-range step, sorted', () => {
    expect(
      anchorRanges(
        [
          { start: 40, end: 42 },
          { start: 500, end: 510 },
          { start: 3, end: 5 },
        ],
        TARGET,
      ).ranges,
    ).toEqual([
      { start: 3, end: 5 },
      { start: 40, end: 42 },
    ]);
  });
});

describe('metrics', () => {
  it('computes anchor rate and coverage over non-blank lines', () => {
    const lines = ['a', '', 'b', 'c', 'd'];
    const m = measure(
      {
        parsed: true,
        complete: true,
        steps: [
          { ranges: [{ start: 1, end: 3 }], anchored: true },
          { ranges: [], anchored: false },
        ],
      },
      lines,
    );
    expect(m).toEqual({ parsed: true, complete: true, steps: 2, anchorRate: 0.5, coverage: 0.5 });
  });
});
