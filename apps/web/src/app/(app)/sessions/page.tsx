'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { TodayList } from '@/components/today-list';
import { Card, EmptyState, ErrorState, Loading, NoAccess, PageHeader, Pagination, Select, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, formatTime, patientName } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { sessionStatusTone } from '@/lib/labels';
import { enumLabel, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import type { Paginated, SessionListItem, SessionStatus, TodaySessions } from '@/lib/types';

export default function SessionsPage() {
  const me = useMe();
  const t = useT();
  const isTherapist = me.role === 'THERAPIST';
  const [therapistId, setTherapistId] = useState(isTherapist ? me.id : '');
  const [status, setStatus] = useState<SessionStatus | ''>('');
  const [page, setPage] = useState(1);
  const clinicians = useClinicians();
  const allowed = can(me.role, 'clinical.view');

  const today = useQuery({
    queryKey: ['sessions', 'today', therapistId],
    queryFn: () => api<TodaySessions>('/sessions/today', { query: { therapistId } }),
    enabled: allowed,
    refetchInterval: 60_000,
  });
  const recent = useQuery({
    queryKey: ['sessions', 'list', therapistId, status, page],
    queryFn: () => api<Paginated<SessionListItem>>('/sessions', { query: { therapistId, status, page, pageSize: 15 } }),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });

  if (!allowed) return <NoAccess />;

  return (
    <>
      <PageHeader
        title={t('sessions.title')}
        subtitle={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Select
            value={therapistId}
            onChange={(e) => {
              setTherapistId(e.target.value);
              setPage(1);
            }}
            aria-label={t('sessions.therapist')}
            className="w-56"
          >
            <option value="">{t('sessions.allTherapists')}</option>
            {clinicians.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === me.id ? t('sessions.meSuffix', { name: c.fullName }) : c.fullName}
              </option>
            ))}
          </Select>
        }
      />
      <div className="space-y-6">
        <Card title={isTherapist && therapistId === me.id ? t('sessions.myPatientsToday') : t('sessions.todaysSessions')}>
          {today.isLoading && <Loading />}
          {today.error && <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />}
          {today.data && today.data.appointments.length === 0 && today.data.walkIns.length === 0 && (
            <EmptyState title={t('sessions.noSessionsToday')} description={t('sessions.noSessionsTodayHint')} />
          )}
          {today.data && today.data.appointments.length > 0 && <TodayList items={today.data.appointments} showTherapist={!therapistId} />}
          {today.data && today.data.walkIns.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-500">{t('sessions.walkIns')}</p>
              <ul className="divide-y divide-slate-100">
                {today.data.walkIns.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sessions/${s.id}`} className="flex min-h-touch items-center justify-between gap-2 py-2 hover:text-primary-700">
                      <span>
                        <span className="mr-3 font-semibold tabular-nums">{formatTime(s.sessionDate)}</span>
                        {patientName(s.patient)}
                      </span>
                      <StatusBadge status={s.status} tones={sessionStatusTone} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card
          title={t('sessions.history')}
          actions={
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as SessionStatus | '');
                setPage(1);
              }}
              aria-label={t('common.status')}
              className="w-40"
            >
              <option value="">{t('sessions.allStatuses')}</option>
              <option value="DRAFT">{enumLabel('DRAFT')}</option>
              <option value="COMPLETED">{enumLabel('COMPLETED')}</option>
              <option value="CANCELLED">{enumLabel('CANCELLED')}</option>
            </Select>
          }
        >
          {recent.isLoading && <Loading />}
          {recent.error && <ErrorState message={errorMessage(recent.error)} onRetry={() => recent.refetch()} />}
          {recent.data && recent.data.data.length === 0 && <EmptyState title={t('sessions.noSessionsFound')} />}
          {recent.data && recent.data.data.length > 0 && (
            <div className="-mx-5 -mb-5">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('sessions.colPatient')}</th>
                      <th>{t('sessions.colTherapist')}</th>
                      <th>{t('sessions.colExercises')}</th>
                      <th>{t('sessions.colMeasurements')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.data.data.map((s) => (
                      <tr key={s.id} className="hover:bg-primary-50/40">
                        <td className="whitespace-nowrap">
                          <Link href={`/sessions/${s.id}`} className="font-medium text-primary-700">
                            {formatDateTime(s.sessionDate)}
                          </Link>
                        </td>
                        <td>
                          <Link href={`/patients/${s.patient.id}`} className="hover:text-primary-700">
                            {patientName(s.patient)}
                          </Link>
                        </td>
                        <td>{s.therapist.fullName}</td>
                        <td className="tabular-nums">{s._count?.exercises ?? 0}</td>
                        <td className="tabular-nums">{s._count?.measurements ?? 0}</td>
                        <td>
                          <StatusBadge status={s.status} tones={sessionStatusTone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={recent.data.page} totalPages={recent.data.totalPages} onChange={setPage} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
