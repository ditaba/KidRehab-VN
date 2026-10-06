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

export default function PatientLayout({ children }: { children: ReactNode }) {
  const id = usePatientId();
  const me = useMe();
  const pathname = usePathname();
  const { data: patient, isLoading, error, refetch } = usePatient(id);

  if (isLoading) return <Loading />;
  if (error || !patient) return <ErrorState message={errorMessage(error) || 'Patient not found'} onRetry={() => refetch()} />;

  const base = `/patients/${id}`;
  const tabs = [
    { href: base, label: 'Overview' },
    ...(can(me.role, 'clinical.view')
      ? [
          { href: `${base}/assessment`, label: 'Assessment' },
          { href: `${base}/treatment`, label: 'Treatment' },
          { href: `${base}/sessions`, label: 'Sessions' },
          { href: `${base}/progress`, label: 'Progress' },
        ]
      : []),
  ];
  const primaryDiagnosis = patient.diagnoses[0]?.name;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/patients" className="text-slate-500 hover:text-primary-700">
          ‹ Patients
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
            {patient.needsReassessment && <Badge tone="amber">Needs reassessment</Badge>}
          </div>
          <p className="text-slate-500">
            {patient.patientCode} · {patient.age} years · {humanize(patient.gender)}
            {primaryDiagnosis && ` · ${primaryDiagnosis}`}
          </p>
        </div>
      </div>
      <nav className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0" aria-label="Patient sections">
        <ul className="flex gap-1">
          {tabs.map((t) => {
            const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={clsx(
                    'flex min-h-touch items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium',
                    active ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {t.label}
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
