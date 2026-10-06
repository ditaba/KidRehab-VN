import { MetricDirection } from '@prisma/client';
import { calculateProgress, isTargetConsistent } from './progress';

describe('calculateProgress', () => {
  it('matches the PRD example: baseline 5, current 22, target 30', () => {
    expect(calculateProgress({ baseline: 5, target: 30, current: 22 })).toEqual({ raw: 68, percent: 68 });
  });

  it('clamps the UI value to 0–100 but keeps the raw value', () => {
    expect(calculateProgress({ baseline: 5, target: 30, current: 2 })).toEqual({ raw: -12, percent: 0 });
    expect(calculateProgress({ baseline: 5, target: 30, current: 35 })).toEqual({ raw: 120, percent: 100 });
  });

  it('supports DECREASE_IS_BETTER metrics', () => {
    const r = calculateProgress({ baseline: 15, target: 3, current: 9, direction: MetricDirection.DECREASE_IS_BETTER });
    expect(r.percent).toBe(50);
    const worse = calculateProgress({ baseline: 15, target: 3, current: 18, direction: MetricDirection.DECREASE_IS_BETTER });
    expect(worse.percent).toBe(0);
  });

  it('returns 0 when there is no current value', () => {
    expect(calculateProgress({ baseline: 5, target: 30, current: null }).percent).toBe(0);
  });

  it('handles degenerate goals without dividing by zero', () => {
    expect(calculateProgress({ baseline: 5, target: 5, current: 5 }).percent).toBe(100);
  });
});

describe('isTargetConsistent', () => {
  it('requires target above baseline when increase is better', () => {
    expect(isTargetConsistent(5, 30, MetricDirection.INCREASE_IS_BETTER)).toBe(true);
    expect(isTargetConsistent(30, 5, MetricDirection.INCREASE_IS_BETTER)).toBe(false);
  });
  it('requires target below baseline when decrease is better', () => {
    expect(isTargetConsistent(15, 3, MetricDirection.DECREASE_IS_BETTER)).toBe(true);
    expect(isTargetConsistent(3, 15, MetricDirection.DECREASE_IS_BETTER)).toBe(false);
  });
});
