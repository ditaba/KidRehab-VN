import { MetricDirection } from '@prisma/client';

/**
 * Progress toward target, in percent.
 *
 *   INCREASE_IS_BETTER: (current - baseline) / (target - baseline) * 100
 *   DECREASE_IS_BETTER: (baseline - current) / (baseline - target) * 100
 *
 * `raw` is the unclamped value (can be negative for regression or >100 when the
 * target is exceeded); `percent` is clamped to 0–100 for display.
 */
export function calculateProgress(input: {
  baseline: number;
  target: number;
  current: number | null | undefined;
  direction?: MetricDirection;
}): { raw: number; percent: number } {
  const { baseline, target, current } = input;
  const direction = input.direction ?? MetricDirection.INCREASE_IS_BETTER;
  if (current === null || current === undefined || Number.isNaN(current)) return { raw: 0, percent: 0 };

  const span = direction === MetricDirection.INCREASE_IS_BETTER ? target - baseline : baseline - target;
  if (span <= 0) {
    // Degenerate goal (target already at/behind baseline): treat reaching the target as 100%.
    const reached =
      direction === MetricDirection.INCREASE_IS_BETTER ? current >= target : current <= target;
    return { raw: reached ? 100 : 0, percent: reached ? 100 : 0 };
  }
  const gained = direction === MetricDirection.INCREASE_IS_BETTER ? current - baseline : baseline - current;
  const raw = (gained / span) * 100;
  const percent = Math.min(100, Math.max(0, raw));
  return { raw: round1(raw), percent: round1(percent) };
}

/** Checks that baseline → target moves in the improving direction. */
export function isTargetConsistent(baseline: number, target: number, direction: MetricDirection): boolean {
  return direction === MetricDirection.INCREASE_IS_BETTER ? target > baseline : target < baseline;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
