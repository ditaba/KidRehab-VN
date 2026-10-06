'use client';

import Link from 'next/link';
import { Badge, Button, LinkButton, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatTime, patientName } from '@/lib/format';
import { useStartSession } from '@/lib/hooks';
import { appointmentStatusTone, sessionStatusTone } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { AppointmentStatus, PatientRef, SessionStatus, UserRef } from '@/lib/types';

export interface TodayItem {
  id: string;
  startAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  patient: PatientRef & { age?: number; diagnosis?: string | null };
  therapist: UserRef;
  session: { id: string; status: SessionStatus } | null;
}

/** US-050: time-ordered list of today's patients with Open Patient / Start Session actions. */
export function TodayList({ items, showTherapist }: { items: TodayItem[]; showTherapist?: boolean }) {
  const me = useMe();
  const start = useStartSession();
  const canWrite = can(me.role, 'session.write');

  return (
    <div>
      {start.error && <p className="mb-3 text-sm text-red-600">{errorMessage(start.error)}</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <span className="w-14 shrink-0 text-lg font-semibold tabular-nums text-slate-900">{formatTime(a.startAt)}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/patients/${a.patient.id}`} className="font-medium text-slate-900 hover:text-primary-700">
                {patientName(a.patient)}
              </Link>
              <p className="truncate text-sm text-slate-500">
                {[a.patient.age !== undefined ? `${a.patient.age} y` : null, a.patient.diagnosis, showTherapist ? a.therapist.fullName : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {a.session ? (
                <StatusBadge status={a.session.status} tones={sessionStatusTone} />
              ) : (
                <StatusBadge status={a.status} tones={appointmentStatusTone} />
              )}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <LinkButton href={`/patients/${a.patient.id}`} variant="secondary" className="flex-1 sm:flex-none">
                Open Patient
              </LinkButton>
              {canWrite &&
                (a.session ? (
                  <LinkButton href={`/sessions/${a.session.id}`} variant={a.session.status === 'DRAFT' ? 'primary' : 'ghost'} className="flex-1 sm:flex-none">
                    {a.session.status === 'DRAFT' ? 'Continue' : 'View Session'}
                  </LinkButton>
                ) : a.status === 'NO_SHOW' || a.status === 'CANCELLED' ? (
                  <Badge>—</Badge>
                ) : (
                  <Button
                    className="flex-1 sm:flex-none"
                    loading={start.isPending && start.variables?.appointmentId === a.id}
                    onClick={() => start.mutate({ patientId: a.patient.id, appointmentId: a.id })}
                  >
                    Start Session
                  </Button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
