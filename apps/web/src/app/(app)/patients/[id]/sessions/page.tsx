'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, ErrorState, Loading, NoAccess, Pagination, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDateTime, formatValue } from '@/lib/format';
import { useStartSession } from '@/lib/hooks';
import { sessionStatusTone } from '@/lib/labels';
import { usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import type { Paginated, SessionListItem } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function PatientSessionsPage() {
  const id = usePatientId();
  const me = useMe();
  const t = useT();
  const [page, setPage] = useState(1);
  const start = useStartSession();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sessions', 'patient', id, page],
    queryFn: () => api<Paginated<SessionListItem>>(`/patients/${id}/sessions`, { query: { page, pageSize: 15 } }),
    placeholderData: keepPreviousData,
    enabled: can(me.role, 'clinical.view'),
  });

  if (!can(me.role, 'clinical.view')) return <NoAccess />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-500">{data ? t(data.total === 1 ? 'progress.sessionsOne' : 'progress.sessionsOther', { count: data.total }) : ' '}</p>
        {can(me.role, 'session.write') && (
          <Button loading={start.isPending} onClick={() => start.mutate({ patientId: id })}>
            {t('progress.startNewSession')}
          </Button>
        )}
      </div>
      {start.error && <p className="text-sm text-red-600">{errorMessage(start.error)}</p>}
      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && <EmptyState title={t('progress.noSessionsTitle')} description={t('progress.noSessionsDescription')} />}
      {data && data.data.length > 0 && (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {data.data.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="block px-5 py-4 hover:bg-primary-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-900">{formatDateTime(s.sessionDate)}</span>
                      <span className="text-sm text-slate-500">
                        {' '}
                        · {s.therapist.fullName}
                        {s.durationMinutes && ` · ${t('common.unitMinutes', { n: s.durationMinutes })}`}
                        {s.tolerance && ` · ${t(`progress.tolerance${s.tolerance}`)}`}
                      </span>
                    </div>
                    <StatusBadge status={s.status} tones={sessionStatusTone} />
                  </div>
                  {s.measurements.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.measurements.map((m) => (
                        <span key={m.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {m.metric.name}: <strong>{formatValue(m.value, m.metric.unit)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {s.notes && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{s.notes}</p>}
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
