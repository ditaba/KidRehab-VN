'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge, ErrorState, Loading, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { humanize, patientName } from '@/lib/format';
import { patientStatusTone } from '@/lib/labels';
import { usePatient, usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import { useT } from '@/lib/i18n';

export default function PatientLayout({ children }: { children: ReactNode }) {
  const id = usePatientId();
  const me = useMe();
  const t = useT();
  const pathname = usePathname();
  const { data: patient, isLoading, error, refetch } = usePatient(id);

  if (isLoading) return <Loading />;
  if (error || !patient) return <ErrorState message={errorMessage(error) || t('patients.patientNotFound')} onRetry={() => refetch()} />;

  const base = `/patients/${id}`;
  const tabs = [
    { href: base, label: t('patients.tabOverview') },
    ...(can(me.role, 'clinical.view')
      ? [
          { href: `${base}/assessment`, label: t('patients.tabAssessment') },
          { href: `${base}/treatment`, label: t('patients.tabTreatment') },
          { href: `${base}/sessions`, label: t('patients.tabSessions') },
          { href: `${base}/progress`, label: t('patients.tabProgress') },
        ]
      : []),
  ];
  const primaryDiagnosis = patient.diagnoses[0]?.name;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/patients" className="text-slate-500 hover:text-primary-700">
          {t('patients.backToPatients')}
        </Link>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-100 text-xl font-semibold text-primary-700">
          {patient.firstName.split(' ').slice(-1)[0]?.charAt(0) ?? '?'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1>{patientName(patient)}</h1>
            <StatusBadge status={patient.status} tones={patientStatusTone} />
            {patient.needsReassessment && <Badge tone="amber">{t('patients.needsReassessment')}</Badge>}
          </div>
          <p className="text-slate-500">
            {patient.patientCode} · {t('patients.ageYears', { age: patient.age })} · {humanize(patient.gender)}
            {primaryDiagnosis && ` · ${primaryDiagnosis}`}
          </p>
        </div>
      </div>
      <nav className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0" aria-label={t('patients.sectionsAria')}>
        <ul className="flex gap-1">
          {tabs.map((tab) => {
            const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={clsx(
                    'flex min-h-touch items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium',
                    active ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </>
  );
}
