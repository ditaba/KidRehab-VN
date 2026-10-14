'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Button, ProgressBar } from '@/components/ui';
import { formatValue } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { progressPercent } from '@/lib/progress';
import type { Measurement, SessionDetail } from '@/lib/types';

type SessionGoal = SessionDetail['goals'][number];

/** US-053: record one metric value for this session, with a live progress preview. */
export function MeasurementInput({
  goal,
  measurement,
  previous,
  disabled,
  saving,
  onSave,
  onRemove,
}: {
  goal: SessionGoal;
  measurement?: Measurement;
  previous?: Measurement;
  disabled: boolean;
  saving: boolean;
  onSave: (value: number) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(measurement ? String(measurement.value) : '');
  useEffect(() => setDraft(measurement ? String(measurement.value) : ''), [measurement]);

  const num = draft.trim() === '' ? null : Number(draft);
  const valid = num !== null && Number.isFinite(num);
  const dirty = valid && num !== measurement?.value;
  const preview = valid ? progressPercent(goal.baselineValue, goal.targetValue, num, goal.direction) : goal.progress.percent;

  return (
    <div className={clsx('rounded-xl border p-4', measurement ? 'border-success-300 bg-success-50/50' : 'border-slate-200')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{goal.metricName}</p>
          <p className="text-sm text-slate-500">
            {t('sessions.goalSummary', { title: goal.title, baseline: formatValue(goal.baselineValue, goal.unit), target: formatValue(goal.targetValue, goal.unit) })}
          </p>
        </div>
        {previous && (
          <span className="text-sm text-slate-500">
            {t('sessions.lastTime')} <strong className="text-slate-700">{formatValue(previous.value, goal.unit)}</strong>
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step="any"
            inputMode="decimal"
            disabled={disabled || !goal.metric}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dirty && onSave(num!)}
            placeholder={t('sessions.valuePlaceholder')}
            aria-label={t('sessions.valueAria', { metric: goal.metricName })}
            className="input pr-20 text-lg font-semibold tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">{goal.unit}</span>
        </div>
        {!disabled && (
          <Button variant={measurement && !dirty ? 'secondary' : 'success'} disabled={!dirty} loading={saving} onClick={() => onSave(num!)} className="min-w-[96px]">
            {measurement && !dirty ? t('sessions.saved') : t('common.save')}
          </Button>
        )}
        {!disabled && measurement && (
          <Button variant="ghost" onClick={onRemove} aria-label={t('sessions.removeMeasurement')}>
            ✕
          </Button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar percent={preview} />
        <span className="w-12 text-right text-sm font-medium tabular-nums">{Math.round(preview)}%</span>
      </div>
    </div>
  );
}
