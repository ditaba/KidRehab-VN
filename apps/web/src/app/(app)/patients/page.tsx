'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, patientName } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { patientStatusTone } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { Paginated, PatientListItem, PatientStatus } from '@/lib/types';
import { useDebounce } from '@/lib/use-debounce';
import { enumLabel, useT } from '@/lib/i18n';

export default function PatientsPage() {
  const me = useMe();
  const router = useRouter();
  const t = useT();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PatientStatus | ''>('ACTIVE');
  const [therapistId, setTherapistId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const debouncedDiagnosis = useDebounce(diagnosis);
  const clinicians = useClinicians();

  const query = { search: debouncedSearch, status, therapistId, diagnosis: debouncedDiagnosis, page, pageSize: 20 };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['patients', query],
    queryFn: () => api<Paginated<PatientListItem>>('/patients', { query }),
    placeholderData: keepPreviousData,
  });

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={t('patients.patients')}
        subtitle={data ? t(data.total === 1 ? 'patients.patientCountOne' : 'patients.patientCountOther', { count: data.total }) : undefined}
        actions={can(me.role, 'patient.create') && <LinkButton href="/patients/new">{t('patients.newPatient')}</LinkButton>}
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="search"
            placeholder={t('patients.searchPlaceholder')}
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            aria-label={t('patients.searchAria')}
          />
          <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as PatientStatus | '')} aria-label={t('common.status')}>
            <option value="">{t('patients.allStatuses')}</option>
            <option value="ACTIVE">{enumLabel('ACTIVE')}</option>
            <option value="INACTIVE">{enumLabel('INACTIVE')}</option>
            <option value="DISCHARGED">{enumLabel('DISCHARGED')}</option>
          </Select>
          <Select value={therapistId} onChange={(e) => resetPage(setTherapistId)(e.target.value)} aria-label={t('patients.therapist')}>
            <option value="">{t('patients.allTherapists')}</option>
            {clinicians.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
          <Input placeholder={t('patients.diagnosis')} value={diagnosis} onChange={(e) => resetPage(setDiagnosis)(e.target.value)} aria-label={t('patients.diagnosis')} />
        </div>
      </Card>

      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState
          title={t('patients.noPatientsFound')}
          description={search || diagnosis || therapistId ? t('patients.noPatientsFiltered') : t('patients.noPatientsYet')}
          action={can(me.role, 'patient.create') && <LinkButton href="/patients/new">{t('patients.createFirstPatient')}</LinkButton>}
        />
      )}
      {data && data.data.length > 0 && (
        <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th>{t('patients.patient')}</th>
                  <th>{t('patients.age')}</th>
                  <th>{t('patients.diagnosis')}</th>
                  <th>{t('patients.therapist')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('patients.colLastSession')}</th>
                  <th>{t('patients.colNextAppointment')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-primary-50/40" onClick={() => router.push(`/patients/${p.id}`)}>
                    <td>
                      <Link href={`/patients/${p.id}`} className="font-medium text-slate-900 hover:text-primary-700" onClick={(e) => e.stopPropagation()}>
                        {patientName(p)}
                      </Link>
                      <div className="text-xs text-slate-500">{p.patientCode}</div>
                    </td>
                    <td className="tabular-nums">{t('patients.ageShort', { age: p.age })}</td>
                    <td className="max-w-[16rem] truncate" title={p.diagnosis ?? undefined}>
                      {p.diagnosis ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td>{p.therapist?.fullName ?? <span className="text-slate-400">{t('patients.unassigned')}</span>}</td>
                    <td>
                      <StatusBadge status={p.status} tones={patientStatusTone} />
                    </td>
                    <td className="whitespace-nowrap">{p.lastSession ? formatDate(p.lastSession.sessionDate) : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap">
                      {p.nextAppointment ? formatDateTime(p.nextAppointment.startAt) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </>
  );
}
