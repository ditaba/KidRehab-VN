'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ExercisePicker } from '@/components/session/exercise-picker';
import { MeasurementInput } from '@/components/session/measurement-input';
import { Stepper } from '@/components/session/stepper';
import { Badge, Button, Card, ChoiceGroup, EmptyState, ErrorState, FormError, Loading, Modal, StatusBadge, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, formatPrescription, formatValue, humanize, patientName } from '@/lib/format';
import { ASSISTANCE, MOODS, sessionStatusTone, TOLERANCES } from '@/lib/labels';
import { useT } from '@/lib/i18n';
import type { Exercise, SessionDetail, SessionExercise } from '@/lib/types';

type Patch = Partial<
  Pick<SessionDetail, 'painScore' | 'energyLevel' | 'mood' | 'tolerance' | 'assistanceLevel' | 'notes' | 'durationMinutes' | 'status'>
>;

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const t = useT();
  const qc = useQueryClient();
  const key = ['session', id];
  const { data: session, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<SessionDetail>(`/sessions/${id}`) });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const notesDirty = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (session && !notesDirty.current) setNotes(session.notes ?? '');
  }, [session]);

  const setSession = (fn: (s: SessionDetail) => SessionDetail) => qc.setQueryData<SessionDetail>(key, (s) => (s ? fn(s) : s));
  const onError = (e: unknown) => {
    setSaveError(errorMessage(e));
    refetch();
  };

  const patch = useMutation({
    mutationFn: (body: Patch) => api<SessionDetail>(`/sessions/${id}`, { method: 'PATCH', body }),
    onMutate: (body) => {
      setSaveError(null);
      setSession((s) => ({ ...s, ...body }));
    },
    onSuccess: (s, body) => {
      if ('notes' in body) notesDirty.current = false;
      qc.setQueryData(key, s);
    },
    onError,
  });

  const addExercise = useMutation({
    mutationFn: (e: Exercise) => api<SessionExercise>(`/sessions/${id}/exercises`, { method: 'POST', body: { exerciseId: e.id } }),
    onSuccess: (se) => setSession((s) => ({ ...s, exercises: [...s.exercises, se] })),
    onError,
  });
  const updateExercise = useMutation({
    mutationFn: ({ seId, body }: { seId: string; body: Partial<SessionExercise> }) =>
      api<SessionExercise>(`/sessions/${id}/exercises/${seId}`, { method: 'PATCH', body }),
    onMutate: ({ seId, body }) => setSession((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === seId ? { ...e, ...body } : e)) })),
    onError,
  });
  const removeExercise = useMutation({
    mutationFn: (seId: string) => api(`/sessions/${id}/exercises/${seId}`, { method: 'DELETE' }),
    onMutate: (seId) => setSession((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== seId) })),
    onError,
  });
  const record = useMutation({
    mutationFn: ({ metricId, value }: { metricId: string; value: number }) =>
      api(`/sessions/${id}/measurements`, { method: 'POST', body: { progressMetricId: metricId, value } }),
    onSuccess: () => refetch(),
    onError,
  });
  const removeMeasurement = useMutation({
    mutationFn: (mid: string) => api(`/sessions/${id}/measurements/${mid}`, { method: 'DELETE' }),
    onSuccess: () => refetch(),
    onError,
  });
  const complete = useMutation({
    mutationFn: () => api<SessionDetail>(`/sessions/${id}/complete`, { method: 'POST', body: { notes } }),
    onSuccess: (s) => {
      notesDirty.current = false;
      qc.setQueryData(key, s);
      setReviewOpen(false);
      for (const k of ['patient', 'progress', 'sessions', 'dashboard', 'treatment-plans', 'patients']) qc.invalidateQueries({ queryKey: [k] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  // Autosave notes shortly after typing stops.
  useEffect(() => {
    if (!notesDirty.current || !session || session.status !== 'DRAFT') return;
    const timer = setTimeout(() => patch.mutate({ notes }), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  if (isLoading) return <Loading />;
  if (error || !session) return <ErrorState message={errorMessage(error) || t('sessions.notFound')} onRetry={() => refetch()} />;

  const editable = session.status === 'DRAFT' && (me.role === 'DOCTOR' || (me.role === 'THERAPIST' && session.therapistId === me.id));
  const measurementFor = (metricId?: string) => session.measurements.find((m) => m.progressMetricId === metricId);
  const previousFor = (metricId?: string) => session.previousSession?.measurements.find((m) => m.progressMetricId === metricId);
  const diagnosis = session.patient.diagnoses.find((d) => d.isPrimary)?.name ?? session.patient.diagnoses[0]?.name;
  const saving = patch.isPending || addExercise.isPending || updateExercise.isPending || record.isPending;

  return (
    <div className={editable ? 'pb-28' : undefined}>
      {/* Header: patient, diagnosis, goals, previous session */}
      <div className="mb-2 text-sm">
        <Link href={`/patients/${session.patientId}/sessions`} className="text-slate-500 hover:text-primary-700">
          ‹ {patientName(session.patient)}
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1>{patientName(session.patient)}</h1>
            <StatusBadge status={session.status} tones={sessionStatusTone} />
          </div>
          <p className="text-slate-500">
            {t('sessions.ageShort', { age: session.patient.age })}{diagnosis && ` · ${diagnosis}`} · {formatDateTime(session.sessionDate)} · {session.therapist.fullName}
          </p>
        </div>
        {editable && <span className="text-sm text-slate-400">{saving ? t('common.saving') : t('sessions.allSaved')}</span>}
      </div>

      {session.status === 'COMPLETED' && (
        <div className="mb-6 rounded-2xl border border-success-200 bg-success-50 px-5 py-4 text-success-700">
          {t('sessions.completedBanner', { date: formatDateTime(session.completedAt) })}{' '}
          <Link href={`/patients/${session.patientId}/progress`} className="font-medium underline">
            {t('sessions.viewProgress')}
          </Link>
        </div>
      )}
      {session.status === 'DRAFT' && !editable && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          {t('sessions.readOnlyDraft', { name: session.therapist.fullName })}
        </div>
      )}
      <FormError message={saveError} />

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={t('sessions.measurements')} actions={session.activePlan && <span className="text-sm text-slate-500">{session.activePlan.title}</span>}>
            {session.goals.length === 0 ? (
              <EmptyState
                title={t('sessions.noActiveGoals')}
                description={t('sessions.noActiveGoalsHint')}
              />
            ) : (
              <div className="space-y-3">
                {session.goals.map((g) => (
                  <MeasurementInput
                    key={g.id}
                    goal={g}
                    measurement={measurementFor(g.metric?.id)}
                    previous={previousFor(g.metric?.id)}
                    disabled={!editable}
                    saving={record.isPending && record.variables?.metricId === g.metric?.id}
                    onSave={(value) => g.metric && record.mutate({ metricId: g.metric.id, value })}
                    onRemove={() => {
                      const m = measurementFor(g.metric?.id);
                      if (m) removeMeasurement.mutate(m.id);
                    }}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title={t('sessions.observations')}>
            <div className="space-y-5">
              <Observation label={t('sessions.pain')} hint={t('sessions.painHint')}>
                <ChoiceGroup
                  ariaLabel={t('sessions.pain')}
                  columns={11}
                  disabled={!editable}
                  value={session.painScore}
                  onChange={(v) => patch.mutate({ painScore: v })}
                  options={Array.from({ length: 11 }, (_, i) => ({ value: i, label: i }))}
                />
              </Observation>
              <Observation label={t('sessions.energy')} hint={t('sessions.energyHint')}>
                <ChoiceGroup
                  ariaLabel={t('sessions.energy')}
                  disabled={!editable}
                  value={session.energyLevel}
                  onChange={(v) => patch.mutate({ energyLevel: v })}
                  options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: v }))}
                />
              </Observation>
              <Observation label={t('sessions.mood')}>
                <ChoiceGroup
                  ariaLabel={t('sessions.mood')}
                  disabled={!editable}
                  value={session.mood}
                  onChange={(v) => patch.mutate({ mood: v })}
                  options={MOODS.map((m) => ({
                    value: m.value,
                    label: (
                      <span className="flex flex-col items-center leading-tight">
                        <span aria-hidden className="text-lg">
                          {m.icon}
                        </span>
                        <span className="text-xs">{m.label}</span>
                      </span>
                    ),
                  }))}
                />
              </Observation>
              <Observation label={t('sessions.tolerance')}>
                <ChoiceGroup
                  ariaLabel={t('sessions.tolerance')}
                  disabled={!editable}
                  value={session.tolerance}
                  onChange={(v) => patch.mutate({ tolerance: v })}
                  options={TOLERANCES}
                />
              </Observation>
              <Observation label={t('sessions.assistance')}>
                <ChoiceGroup
                  ariaLabel={t('sessions.assistanceLevel')}
                  columns={3}
                  disabled={!editable}
                  value={session.assistanceLevel}
                  onChange={(v) => patch.mutate({ assistanceLevel: v })}
                  options={ASSISTANCE}
                />
              </Observation>
              <div className="max-w-[16rem]">
                <Stepper
                  label={t('sessions.durationMin')}
                  step={5}
                  min={0}
                  max={480}
                  disabled={!editable}
                  value={session.durationMinutes}
                  onChange={(v) => patch.mutate({ durationMinutes: v || null })}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title={t('sessions.exercisesCount', { count: session.exercises.length })}
            actions={
              editable && (
                <Button variant="secondary" onClick={() => setPickerOpen(true)}>
                  {t('sessions.addExerciseButton')}
                </Button>
              )
            }
          >
            {session.exercises.length === 0 ? (
              <p className="text-sm text-slate-500">{t('sessions.noExercises')}</p>
            ) : (
              <ul className="space-y-4">
                {session.exercises.map((e) => (
                  <li key={e.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{e.exerciseName}</p>
                      {editable ? (
                        <Button variant="ghost" size="sm" onClick={() => removeExercise.mutate(e.id)} aria-label={t('sessions.removeItem', { name: e.exerciseName })}>
                          {t('common.remove')}
                        </Button>
                      ) : (
                        <span className="text-sm text-slate-500">{formatPrescription(e)}</span>
                      )}
                    </div>
                    {editable && (
                      <div className="mt-2 space-y-2">
                        <Stepper label={t('sessions.sets')} inline value={e.sets} max={100} onChange={(v) => updateExercise.mutate({ seId: e.id, body: { sets: v } })} />
                        <Stepper label={t('sessions.reps')} inline value={e.repetitions} max={1000} onChange={(v) => updateExercise.mutate({ seId: e.id, body: { repetitions: v } })} />
                        <Stepper
                          label={t('sessions.seconds')} inline
                          step={5}
                          value={e.durationSeconds}
                          max={7200}
                          onChange={(v) => updateExercise.mutate({ seId: e.id, body: { durationSeconds: v } })}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('sessions.sessionNotes')}>
            <Textarea
              rows={5}
              disabled={!editable}
              value={notes}
              placeholder={editable ? t('sessions.notesPlaceholder') : t('sessions.noNotes')}
              onChange={(e) => {
                notesDirty.current = true;
                setNotes(e.target.value);
              }}
              onBlur={() => notesDirty.current && patch.mutate({ notes })}
            />
          </Card>

          <Card title={t('sessions.previousSession')}>
            {session.previousSession ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-900">
                  <Link href={`/sessions/${session.previousSession.id}`} className="hover:text-primary-700">
                    {formatDate(session.previousSession.sessionDate)}
                  </Link>{' '}
                  · {session.previousSession.therapist.fullName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {session.previousSession.tolerance && <Badge>{t('sessions.prevTolerance', { value: humanize(session.previousSession.tolerance) })}</Badge>}
                  {session.previousSession.assistanceLevel && <Badge>{t('sessions.prevAssistance', { value: humanize(session.previousSession.assistanceLevel) })}</Badge>}
                  {session.previousSession.painScore !== null && <Badge>{t('sessions.prevPain', { value: session.previousSession.painScore })}</Badge>}
                </div>
                {session.previousSession.measurements.length > 0 && (
                  <p className="text-slate-600">
                    {session.previousSession.measurements.map((m) => `${m.metric.name}: ${formatValue(m.value, m.metric.unit)}`).join(' · ')}
                  </p>
                )}
                {session.previousSession.exercises.length > 0 && (
                  <p className="text-slate-600">{session.previousSession.exercises.map((e) => e.exerciseName).join(', ')}</p>
                )}
                {session.previousSession.notes && <p className="whitespace-pre-line text-slate-700">{session.previousSession.notes}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('sessions.firstSession')}</p>
            )}
          </Card>
        </div>
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={() => confirm(t('sessions.cancelConfirm')) && patch.mutate({ status: 'CANCELLED' })}
            >
              {t('sessions.cancelSession')}
            </Button>
            <Button size="lg" variant="success" onClick={() => setReviewOpen(true)}>
              {t('sessions.reviewComplete')}
            </Button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        addedIds={session.exercises.map((e) => e.exerciseId)}
        onPick={(e) => {
          addExercise.mutate(e);
          setPickerOpen(false);
        }}
      />

      {/* US-054: summary before completion */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={t('sessions.completeTitle')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>
              {t('sessions.keepEditing')}
            </Button>
            <Button variant="success" size="lg" loading={complete.isPending} onClick={() => complete.mutate()}>
              {t('sessions.completeButton')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <FormError message={complete.error ? errorMessage(complete.error) : null} />
          <ReviewSection title={t('sessions.exercisesPerformed')}>
            {session.exercises.length ? (
              <ul className="list-inside list-disc">
                {session.exercises.map((e) => (
                  <li key={e.id}>
                    {e.exerciseName} — {formatPrescription(e)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-400">{t('common.none')}</span>
            )}
          </ReviewSection>
          <ReviewSection title={t('sessions.measurements')}>
            {session.measurements.length ? (
              <ul className="list-inside list-disc">
                {session.measurements.map((m) => (
                  <li key={m.id}>
                    {m.metric.name}: <strong>{formatValue(m.value, m.metric.unit)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-amber-700">{t('sessions.noMeasurementsWarning')}</span>
            )}
          </ReviewSection>
          <ReviewSection title={t('sessions.tolerance')}>{session.tolerance ? humanize(session.tolerance) : <span className="text-slate-400">{t('common.notRecorded')}</span>}</ReviewSection>
          <ReviewSection title={t('common.notes')}>
            {notes ? <span className="whitespace-pre-line">{notes}</span> : <span className="text-slate-400">{t('sessions.noNotes')}</span>}
          </ReviewSection>
          <p className="text-sm text-slate-500">{t('sessions.completedLocked')}</p>
        </div>
      </Modal>
    </div>
  );
}

function Observation({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">
        {label} {hint && <span className="font-normal text-slate-400">· {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 text-slate-800">{children}</div>
    </div>
  );
}
