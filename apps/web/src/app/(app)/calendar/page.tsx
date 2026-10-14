'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppointmentModal } from '@/components/calendar/appointment-modal';
import { Button, ErrorState, Loading, PageHeader, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { addDays, CalendarView, sameDay, shiftAnchor, viewRange } from '@/lib/calendar';
import { formatDate, formatTime, humanize, patientName } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { intlLocale, MessageKey, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import type { Appointment, AppointmentStatus, PatientDetail, PatientRef } from '@/lib/types';

const viewLabel: Record<CalendarView, MessageKey> = {
  day: 'calendar.viewDay',
  week: 'calendar.viewWeek',
  month: 'calendar.viewMonth',
};

const statusStyle: Record<AppointmentStatus, string> = {
  SCHEDULED: 'border-l-primary-500 bg-primary-50',
  CONFIRMED: 'border-l-violet-500 bg-violet-50',
  COMPLETED: 'border-l-success-500 bg-success-50',
  CANCELLED: 'border-l-slate-300 bg-slate-50 text-slate-400 line-through',
  NO_SHOW: 'border-l-red-500 bg-red-50',
};

export default function CalendarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const me = useMe();
  const t = useT();
  const params = useSearchParams();
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [therapistId, setTherapistId] = useState(me.role === 'THERAPIST' ? me.id : '');
  const [modal, setModal] = useState<{ appointment: Appointment | null; date?: Date; patient?: PatientRef | null } | null>(null);
  const clinicians = useClinicians();
  const canEdit = can(me.role, 'appointment.edit');

  // Deep link from a patient page: /calendar?patientId=… opens the booking form.
  const presetPatientId = params.get('patientId');
  useEffect(() => {
    if (!presetPatientId || !canEdit) return;
    api<PatientDetail>(`/patients/${presetPatientId}`)
      .then((p) => setModal({ appointment: null, patient: p }))
      .catch(() => undefined);
  }, [presetPatientId, canEdit]);

  const { from, to, days } = viewRange(view, anchor);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['appointments', from.toISOString(), to.toISOString(), therapistId],
    queryFn: () => api<Appointment[]>('/appointments', { query: { from: from.toISOString(), to: to.toISOString(), therapistId } }),
    placeholderData: keepPreviousData,
  });
  const forDay = (d: Date) => (data ?? []).filter((a) => sameDay(new Date(a.startAt), d));

  const title =
    view === 'day'
      ? formatDate(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(days[0], { year: undefined })} – ${formatDate(days[6])}`
        : anchor.toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' });

  const open = (a: Appointment) => setModal({ appointment: a });

  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        actions={canEdit && <Button onClick={() => setModal({ appointment: null, date: view === 'day' ? withTime(anchor) : undefined })}>{t('calendar.newAppointment')}</Button>}
      />
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex gap-1">
          <Button variant="secondary" onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))} aria-label={t('common.previous')}>
            ‹
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(new Date())}>
            {t('calendar.today')}
          </Button>
          <Button variant="secondary" onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))} aria-label={t('common.next')}>
            ›
          </Button>
        </div>
        <h2 className="min-w-[12rem] flex-1">{title}</h2>
        <Select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="w-52" aria-label={t('calendar.therapist')}>
          <option value="">{t('calendar.allTherapists')}</option>
          {clinicians.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </Select>
        <div className="flex rounded-xl border border-slate-300 p-0.5" role="tablist">
          {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx('min-h-[40px] rounded-lg px-4 text-sm font-medium capitalize', view === v ? 'bg-primary-600 text-white' : 'text-slate-600')}
            >
              {t(viewLabel[v])}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && (
        <div className={clsx(isFetching && 'opacity-70')}>
          {view === 'day' && (
            <div className="card divide-y divide-slate-100">
              {forDay(anchor).length === 0 && <p className="p-8 text-center text-slate-500">{t('calendar.noAppointmentsDay')}</p>}
              {forDay(anchor).map((a) => (
                <button key={a.id} onClick={() => open(a)} className="flex min-h-[64px] w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-slate-50">
                  <span className="w-28 font-semibold tabular-nums">
                    {formatTime(a.startAt)} – {formatTime(new Date(new Date(a.startAt).getTime() + a.durationMinutes * 60000))}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">{patientName(a.patient)}</span>
                    <span className="block text-sm text-slate-500">
                      {a.therapist.fullName} · {t('common.unitMinutes', { n: a.durationMinutes })}
                    </span>
                  </span>
                  <span className={clsx('rounded-lg border-l-4 px-2 py-1 text-xs font-medium', statusStyle[a.status])}>{humanize(a.status)}</span>
                </button>
              ))}
            </div>
          )}

          {view === 'week' && (
            <div className="card overflow-x-auto">
              <div className="grid min-w-[700px] grid-cols-7 divide-x divide-slate-100">
                {days.map((d) => (
                  <div key={d.toISOString()} className="min-h-[24rem]">
                    <button
                      onClick={() => (setAnchor(d), setView('day'))}
                      className={clsx('block w-full border-b border-slate-100 px-2 py-2 text-left', sameDay(d, new Date()) && 'bg-primary-50')}
                    >
                      <span className="block text-xs uppercase text-slate-500">{d.toLocaleDateString(intlLocale(), { weekday: 'short' })}</span>
                      <span className={clsx('text-lg font-semibold', sameDay(d, new Date()) && 'text-primary-700')}>{d.getDate()}</span>
                    </button>
                    <div className="space-y-1.5 p-1.5">
                      {forDay(d).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => open(a)}
                          className={clsx('block min-h-touch w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs', statusStyle[a.status])}
                        >
                          <span className="font-semibold tabular-nums">{formatTime(a.startAt)}</span>{' '}
                          <span className="font-medium">{patientName(a.patient)}</span>
                          {!therapistId && <span className="block truncate text-slate-500">{a.therapist.fullName}</span>}
                        </button>
                      ))}
                      {canEdit && (
                        <button
                          onClick={() => setModal({ appointment: null, date: withTime(d) })}
                          className="block min-h-touch w-full rounded-lg text-xs text-slate-400 hover:bg-slate-50 hover:text-primary-700"
                          aria-label={t('calendar.addAppointmentOn', { date: formatDate(d) })}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'month' && (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
                {days.slice(0, 7).map((d) => (
                  <div key={d.getDay()} className="py-2">
                    {d.toLocaleDateString(intlLocale(), { weekday: 'short' })}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {days.map((d) => {
                  const items = forDay(d);
                  const inMonth = d.getMonth() === anchor.getMonth();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => (setAnchor(d), setView('day'))}
                      className={clsx('min-h-[6.5rem] p-1.5 text-left align-top hover:bg-slate-50', !inMonth && 'bg-slate-50/60 text-slate-400')}
                    >
                      <span
                        className={clsx(
                          'inline-grid h-7 w-7 place-items-center rounded-full text-sm',
                          sameDay(d, new Date()) && 'bg-primary-600 font-semibold text-white',
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span className="mt-1 block space-y-0.5">
                        {items.slice(0, 3).map((a) => (
                          <span key={a.id} className={clsx('block truncate rounded border-l-2 px-1 text-[11px]', statusStyle[a.status])}>
                            {formatTime(a.startAt)} {a.patient.lastName} {a.patient.firstName}
                          </span>
                        ))}
                        {items.length > 3 && <span className="block px-1 text-[11px] text-slate-500">{t('calendar.moreCount', { count: items.length - 3 })}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <AppointmentModal appointment={modal.appointment} initialDate={modal.date} initialPatient={modal.patient} onClose={() => setModal(null)} />
      )}
    </>
  );
}

/** A sensible default start time (09:00) on the given day. */
function withTime(d: Date) {
  const r = addDays(d, 0);
  r.setHours(9, 0, 0, 0);
  return r;
}
