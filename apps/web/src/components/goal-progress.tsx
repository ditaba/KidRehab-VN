import { ProgressBar, StatusBadge } from '@/components/ui';
import { formatValue } from '@/lib/format';
import { goalStatusTone } from '@/lib/labels';
import type { Goal } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** Baseline → Current → Target with % toward target (US-060). */
export function GoalProgress({ goal, compact }: { goal: Goal; compact?: boolean }) {
  const t = useT();
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{goal.title}</p>
          {!compact && (
            <p className="text-sm text-slate-500">
              {goal.metricName}
              {goal.direction === 'DECREASE_IS_BETTER' && t('treatment.lowerIsBetterSuffix')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!compact && <StatusBadge status={goal.status} tones={goalStatusTone} />}
          <span className="text-lg font-semibold tabular-nums text-slate-900">{Math.round(goal.progress.percent)}%</span>
        </div>
      </div>
      <ProgressBar percent={goal.progress.percent} className="mt-2" />
      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">{t('treatment.progressBaseline')}</dt>
          <dd className="font-medium tabular-nums">{formatValue(goal.baselineValue, goal.unit)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-slate-500">{t('treatment.progressCurrent')}</dt>
          <dd className="font-semibold tabular-nums text-primary-700">{formatValue(goal.currentValue ?? goal.baselineValue, goal.unit)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-slate-500">{t('treatment.progressTarget')}</dt>
          <dd className="font-medium tabular-nums">{formatValue(goal.targetValue, goal.unit)}</dd>
        </div>
      </dl>
    </div>
  );
}
