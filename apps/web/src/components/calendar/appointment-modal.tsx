'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PatientPicker } from '@/components/patient-picker';
import { Button, Field, FormError, Input, LinkButton, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDateTime, humanize, patientName, toInputDate, toInputTime } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { APPOINTMENT_STATUSES } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { Appointment, AppointmentStatus, PatientRef } from '@/lib/types';

interface Conflict {
  id: string;
  startAt: string;
  durationMinutes: number;
  patient: PatientRef;
}

/** US-081: create or edit an appointment. Overlaps for the therapist produce a warning the user can override. */
export function AppointmentModal({
  appointment,
  initialDate,
  initialPatient,
  onClose,
}: {
  appointment: Appointment | null;
  initialDate?: Date;
  initialPatient?: PatientRef | null;
  onClose: () => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const clinicians = useClinicians();
  const clinic = useQuery({ queryKey: ['clinic'], queryFn: () => api<{ defaultAppointmentMinutes: number }>('/clinic') });
  const editable = can(me.role, 'appointment.edit');

  const start = appointment ? new Date(appointment.startAt) : (initialDate ?? nextSlot());
  const [patient, setPatient] = useState<PatientRef | null>(appointment?.patient ?? initialPatient ?? null);
  const [therapistId, setTherapistId] = useState(appointment?.therapistId ?? '');
  const [date, setDate] = useState(toInputDate(start));
  const [time, setTime] = useState(toInputTime(start));
  const [duration, setDuration] = useState<string>(appointment ? String(appointment.durationMinutes) : '');
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? 'SCHEDULED');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  const effectiveDuration = duration || String(clinic.data?.defaultAppointmentMinutes ?? 45);

  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = {
        therapistId,
        startAt: new Date(`${date}T${time}`).toISOString(),
        durationMinutes: Number(effectiveDuration),
        status,
        notes: notes || undefined,
        force: force || undefined,
      };
      return appointment
        ? api(`/appointments/${appointment.id}`, { method: 'PATCH', body })
        : api('/appointments', { method: 'POST', body: { ...body, patientId: patient!.id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      if (patient) qc.invalidateQueries({ queryKey: ['patient', patient.id] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409 && (e.body as { code?: string })?.code === 'THERAPIST_OVERLAP') {
        setConflicts((e.body as { conflicts: Conflict[] }).conflicts);
      }
    },
  });

  const submit = (force = false) => {
    const errs: Record<string, string> = {};
    if (!patient) errs.patient = 'Patient is required';
    if (!therapistId) errs.therapist = 'Therapist is required';
    if (!date || !time) errs.date = 'Date and time are required';
    const d = Number(effectiveDuration);
    if (!Number.isInteger(d) || d < 5 || d > 240) errs.duration = 'Duration must be 5–240 minutes';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setConflicts(null);
    save.mutate(force);
  };

  const showError = save.error && !(save.error instanceof ApiError && save.error.status === 409 && conflicts);

  return (
    <Modal
      open
      onClose={onClose}
      title={appointment ? (editable ? 'Edit appointment' : 'Appointment') : 'New appointment'}
      footer={
        editable ? (
          <>
            {appointment?.session && (
              <LinkButton href={`/sessions/${appointment.session.id}`} variant="ghost" className="mr-auto">
                Open session
              </LinkButton>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {conflicts ? (
              <Button variant="danger" loading={save.isPending} onClick={() => submit(true)}>
                Book anyway
              </Button>
            ) : (
              <Button loading={save.isPending} onClick={() => submit(false)}>
                Save
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {showError && <FormError message={errorMessage(save.error)} />}
        {conflicts && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
            <p className="font-semibold">This therapist already has an overlapping appointment:</p>
            <ul className="mt-1 list-inside list-disc">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {formatDateTime(c.startAt)} ({c.durationMinutes} min) — {patientName(c.patient)}
                </li>
              ))}
            </ul>
            <p className="mt-1">Change the time or therapist, or choose “Book anyway”.</p>
          </div>
        )}
        <Field label="Patient" required error={errors.patient}>
          {appointment || !editable ? (
            <div className="input flex items-center bg-slate-50">{patient ? patientName(patient) : '—'}</div>
          ) : (
            <PatientPicker value={patient} onChange={setPatient} />
          )}
        </Field>
        <Field label="Therapist" required error={errors.therapist}>
          <Select value={therapistId} disabled={!editable} onChange={(e) => (setTherapistId(e.target.value), setConflicts(null))}>
            <option value="">Select therapist</option>
            {clinicians.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({humanize(t.role)})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={date} disabled={!editable} onChange={(e) => (setDate(e.target.value), setConflicts(null))} />
          </Field>
          <Field label="Start time" required>
            <Input type="time" step={300} value={time} disabled={!editable} onChange={(e) => (setTime(e.target.value), setConflicts(null))} />
          </Field>
          <Field label="Duration (min)" error={errors.duration} hint={!duration ? `Clinic default: ${effectiveDuration} min` : undefined}>
            <Input
              type="number"
              inputMode="numeric"
              min={5}
              max={240}
              step={5}
              placeholder={effectiveDuration}
              value={duration}
              disabled={!editable}
              onChange={(e) => (setDuration(e.target.value), setConflicts(null))}
            />
          </Field>
          <Field label="Status">
            <Select value={status} disabled={!editable} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function nextSlot() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}
