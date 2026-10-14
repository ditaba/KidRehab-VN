'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { GoalProgress } from '@/components/goal-progress';
import { ProgressChart } from '@/components/progress-chart';
import { Card, EmptyState, ErrorState, LinkButton, Loading, NoAccess, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDay, formatValue } from '@/lib/format';
import { planStatusTone } from '@/lib/labels';
import { usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import type { ProgressGoal } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function ProgressPage() {
  const id = usePatientId();
  const me = useMe();
  const t = useT();
  const [showPast, setShowPast] = useState(false);
  const [tableFor, setTableFor] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['progress', id],
    queryFn: () => api<{ goals: ProgressGoal[] }>(`/patients/${id}/progress`),
    enabled: can(me.role, 'clinical.view'),
  });

  if (!can(me.role, 'clinical.view')) return <NoAccess />;
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const current = data.goals.filter((g) => g.plan.status === 'ACTIVE' || g.plan.status === 'DRAFT');
  const past = data.goals.filter((g) => !current.includes(g));
  const goals = showPast ? data.goals : current;

  if (data.goals.length === 0) {
    return (
      <EmptyState
        title={t('progress.emptyTitle')}
        description={t('progress.emptyDescription')}
        action={can(me.role, 'treatment.edit') && <LinkButton href={`/patients/${id}/treatment`}>{t('progress.createGoal')}</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {past.length > 0 && (
        <label className="flex min-h-touch items-center gap-3 text-sm text-slate-600">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          {t('progress.includePast', { count: past.length })}
        </label>
      )}
      {goals.length === 0 && <EmptyState title={t('progress.noGoalsActive')} />}
      {goals.map((g) => {
        const showTable = tableFor === g.id;
        return (
          <Card
            key={g.id}
            title={
              <div>
                <h2>{g.metricName}</h2>
                <p className="text-sm text-slate-500">
                  {g.plan.title} {g.plan.status !== 'ACTIVE' && <StatusBadge status={g.plan.status} tones={planStatusTone} />}
                  {g.targetDate && t('progress.deadlineSuffix', { date: formatDay(g.targetDate) })}
                </p>
              </div>
            }
            actions={
              g.measurements.length > 0 && (
                <button className="min-h-touch px-2 text-sm text-primary-700" onClick={() => setTableFor(showTable ? null : g.id)}>
                  {showTable ? t('progress.showChart') : t('progress.showTable')}
                </button>
              )
            }
          >
            <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="space-y-4">
                <GoalProgress goal={g} />
                <p className="text-sm text-slate-500">
                  {t(g.measurements.length === 1 ? 'progress.measurementsOne' : 'progress.measurementsOther', { count: g.measurements.length })}
                  {g.measurements.length > 0 && t('progress.latestSuffix', { date: formatDate(g.measurements[g.measurements.length - 1].measuredAt) })}
                </p>
              </div>
              {g.measurements.length === 0 ? (
                <EmptyState title={t('progress.noMeasurementsTitle')} description={t('progress.noMeasurementsDescription')} />
              ) : showTable ? (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead className="border-b border-slate-100">
                      <tr>
                        <th>{t('common.date')}</th>
                        <th>{t('progress.colValue')}</th>
                        <th>{t('progress.colTherapist')}</th>
                        <th>{t('progress.colSession')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {g.measurements.map((m) => (
                        <tr key={m.id}>
                          <td>{formatDate(m.measuredAt)}</td>
                          <td className="font-medium tabular-nums">{formatValue(m.value, g.unit)}</td>
                          <td>{m.therapist}</td>
                          <td>
                            {m.sessionId ? (
                              <Link href={`/sessions/${m.sessionId}`} className="text-primary-700">
                                {t('progress.open')}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ProgressChart goal={g} />
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
