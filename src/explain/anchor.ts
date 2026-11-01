// Ties step ranges to the target (arch §5.7, spec §10) and computes the evaluation rates. Pure.
import type { LineRange } from '../state/types';

/** Ranges this far outside the target are clamped; farther ones are dropped. */
export const CLAMP_TOLERANCE = 2;

export interface Anchored {
  ranges: LineRange[];
  /** False when no range could be tied to the target. */
  anchored: boolean;
}

export function anchorRanges(ranges: readonly LineRange[], target: LineRange): Anchored {
  const kept: LineRange[] = [];
  for (const r of ranges) {
    if (r.start < target.start - CLAMP_TOLERANCE || r.end > target.end + CLAMP_TOLERANCE) {
      continue;
    }
    const start = Math.max(r.start, target.start);
    const end = Math.min(r.end, target.end);
    if (start <= end) {
      kept.push({ start, end });
    }
  }
  kept.sort((a, b) => a.start - b.start);
  return { ranges: kept, anchored: kept.length > 0 };
}

export interface WalkthroughMetrics {
  /** The response used the protocol at all. */
  parsed: boolean;
  /** The response ended with `@@end`. */
  complete: boolean;
  steps: number;
  /** Share of steps with at least one valid range; 0 with no steps. */
  anchorRate: number;
  /** Share of non-blank target lines inside some anchored step. */
  coverage: number;
}

export function measure(
  result: { parsed: boolean; complete: boolean; steps: readonly Anchored[] },
  lines: readonly string[],
): WalkthroughMetrics {
  const anchored = result.steps.filter((s) => s.anchored);
  const covered = new Set<number>();
  for (const step of anchored) {
    for (const r of step.ranges) {
      for (let l = r.start; l <= r.end; l++) {
        covered.add(l);
      }
    }
  }
  let nonBlank = 0;
  let inside = 0;
  lines.forEach((text, i) => {
    if (text.trim()) {
      nonBlank++;
      if (covered.has(i + 1)) {
        inside++;
      }
    }
  });
  return {
    parsed: result.parsed,
    complete: result.complete,
    steps: result.steps.length,
    anchorRate: result.steps.length ? anchored.length / result.steps.length : 0,
    coverage: nonBlank ? inside / nonBlank : 0,
  };
}
