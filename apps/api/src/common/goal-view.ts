import { MetricDirection } from '@prisma/client';
import { calculateProgress } from './progress';

/** Decorates a goal with its computed progress percentage. */
export function withProgress<
  T extends { baselineValue: number; targetValue: number; currentValue: number | null; direction: MetricDirection },
>(goal: T) {
  return {
    ...goal,
    progress: calculateProgress({
      baseline: goal.baselineValue,
      target: goal.targetValue,
      current: goal.currentValue ?? goal.baselineValue,
      direction: goal.direction,
    }),
  };
}
