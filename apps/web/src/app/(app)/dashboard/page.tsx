'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TodayList } from '@/components/today-list';
import { Card, EmptyState, ErrorState, LinkButton, Loading, PageHeader, Stat } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, patientName } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { DashboardData } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const me = useMe();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me.fullName.split(' ').slice(-1)[0]}`}
        subtitle={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={can(me.role, 'patient.create') && <LinkButton href="/patients/new">New patient</LinkButton>}
      />
      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Active Patients" value={data.stats.activePatients} tone="blue" hint={me.role === 'THERAPIST' ? 'Assigned to you' : 'In your clinic'} />
            <Stat
              label="Today's Sessions"
              value={data.stats.todaySessions}
              tone="green"
              hint={`${data.stats.todaySessionsCompleted} completed`}
            />
            <Stat label="Need Reassessment" value={data.stats.needReassessment} tone="amber" hint="Overdue assessment or plan review" />
            <Stat label="Missed Appointments" value={data.stats.missedAppointments} tone="red" hint="Last 30 days" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title="Today's schedule"
              actions={<LinkButton href="/calendar" variant="ghost">Open calendar</LinkButton>}
            >
              {data.todayAppointments.length === 0 ? (
                <EmptyState title="No appointments today" description="Enjoy a lighter day, or schedule patients from the calendar." />
              ) : (
                <TodayList items={data.todayAppointments} showTherapist={me.role !== 'THERAPIST'} />
              )}
            </Card>

            <Card title="Need reassessment">
              {data.needReassessmentPatients.length === 0 ? (
                <EmptyState title="All caught up" description="Every active patient has a recent assessment." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.needReassessmentPatients.map((p) => (
                    <li key={p.id}>
                      <Link href={`/patients/${p.id}/assessment`} className="flex min-h-touch items-center justify-between gap-2 py-2 hover:text-primary-700">
                        <span>
                          <span className="font-medium">{patientName(p)}</span>
                          <span className="block text-sm text-slate-500">
                            {p.age} y · Last assessed {p.lastAssessedAt ? formatDate(p.lastAssessedAt) : 'never'}
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
