'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TodayList } from '@/components/today-list';
import { Card, EmptyState, ErrorState, LinkButton, Loading, PageHeader, Stat } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, patientName } from '@/lib/format';
import { MessageKey, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import type { DashboardData } from '@/lib/types';

function greetingKey(): MessageKey {
  const h = new Date().getHours();
  return h < 12 ? 'dashboard.goodMorning' : h < 18 ? 'dashboard.goodAfternoon' : 'dashboard.goodEvening';
}

export default function DashboardPage() {
  const me = useMe();
  const t = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title={t('dashboard.greeting', { greeting: t(greetingKey()), name: me.fullName.split(' ').slice(-1)[0] })}
        subtitle={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={can(me.role, 'patient.create') && <LinkButton href="/patients/new">{t('dashboard.newPatient')}</LinkButton>}
      />
      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={t('dashboard.activePatients')} value={data.stats.activePatients} tone="blue" hint={me.role === 'THERAPIST' ? t('dashboard.assignedToYou') : t('dashboard.inYourClinic')} />
            <Stat
              label={t('dashboard.todaysSessions')}
              value={data.stats.todaySessions}
              tone="green"
              hint={t('dashboard.completedCount', { count: data.stats.todaySessionsCompleted })}
            />
            <Stat label={t('dashboard.needReassessmentStat')} value={data.stats.needReassessment} tone="amber" hint={t('dashboard.needReassessmentHint')} />
            <Stat label={t('dashboard.missedAppointments')} value={data.stats.missedAppointments} tone="red" hint={t('dashboard.last30Days')} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title={t('dashboard.todaysSchedule')}
              actions={<LinkButton href="/calendar" variant="ghost">{t('dashboard.openCalendar')}</LinkButton>}
            >
              {data.todayAppointments.length === 0 ? (
                <EmptyState title={t('dashboard.noAppointmentsToday')} description={t('dashboard.noAppointmentsTodayDescription')} />
              ) : (
                <TodayList items={data.todayAppointments} showTherapist={me.role !== 'THERAPIST'} />
              )}
            </Card>

            <Card title={t('dashboard.needReassessment')}>
              {data.needReassessmentPatients.length === 0 ? (
                <EmptyState title={t('dashboard.allCaughtUp')} description={t('dashboard.allCaughtUpDescription')} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.needReassessmentPatients.map((p) => (
                    <li key={p.id}>
                      <Link href={`/patients/${p.id}/assessment`} className="flex min-h-touch items-center justify-between gap-2 py-2 hover:text-primary-700">
                        <span>
                          <span className="font-medium">{patientName(p)}</span>
                          <span className="block text-sm text-slate-500">
                            {t('dashboard.ageShort', { age: p.age })} ·{' '}
                            {p.lastAssessedAt ? t('dashboard.lastAssessed', { date: formatDate(p.lastAssessedAt) }) : t('dashboard.neverAssessed')}
                          </span>
                        </span>
                        <span aria-hidden className="text-slate-400">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
