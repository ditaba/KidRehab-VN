import type { Direction } from './types';

/** Client-side mirror of the API calculation (used for live previews while typing). */
export function progressPercent(baseline: number, target: number, current: number | null | undefined, direction: Direction = 'INCREASE_IS_BETTER') {
  if (current === null || current === undefined || Number.isNaN(current)) return 0;
  const span = direction === 'INCREASE_IS_BETTER' ? target - baseline : baseline - target;
  if (span <= 0) return 0;
  const gained = direction === 'INCREASE_IS_BETTER' ? current - baseline : baseline - current;
  return Math.round(Math.min(100, Math.max(0, (gained / span) * 100)));
}

export function progressTone(percent: number) {
  if (percent >= 100) return 'bg-success-500';
  if (percent >= 50) return 'bg-success-400';
  if (percent > 0) return 'bg-primary-400';
  return 'bg-slate-300';
}
