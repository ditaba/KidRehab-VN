'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GoalProgress } from '@/components/goal-progress';
import { DiagnosesCard } from '@/components/patient/diagnoses-card';
import { EditPatientModal } from '@/components/patient/edit-patient-modal';
import { GuardiansCard } from '@/components/patient/guardians-card';
import { Badge, Button, Card, EmptyState, LinkButton, Loading, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, formatDay, humanize } from '@/lib/format';
import { useStartSession } from '@/lib/hooks';
import { planStatusTone, sessionStatusTone } from '@/lib/labels';
import { usePatient, usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import { useT } from '@/lib/i18n';

export default function PatientOverviewPage() {
  const id = usePatientId();
  const me = useMe();
  const t = useT();
  const { data: patient } = usePatient(id);
  const [editing, setEditing] = useState(false);
  const start = useStartSession();
  if (!patient) return <Loading />;

  const base = `/patients/${id}`;
  const goals = patient.activePlan?.goals ?? [];
  const activeGoals = goals.filter((g) => g.status !== 'CANCELLED');
  const avg = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress.percent, 0) / activeGoals.length) : null;
  const achieved = goals.filter((g) => g.status === 'ACHIEVED' || g.progress.percent >= 100).length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {patient.clinicalAccess && (
          <div className="flex flex-wrap gap-2">
            {can(me.role, 'session.write') && patient.status === 'ACTIVE' && (
              <Button size="lg" loading={start.isPending} onClick={() => start.mutate({ patientId: id })}>
                {t('patients.startSession')}
              </Button>
            )}
            <LinkButton href={`${base}/progress`} variant="secondary">
              {t('patients.viewProgress')}
            </LinkButton>
            {start.error && <p className="w-full text-sm text-red-600">{errorMessage(start.error)}</p>}
          </div>
        )}

        {patient.clinicalAccess && (
          <Card
            title={t('patients.treatmentStatus')}
            actions={
              <LinkButton href={`${base}/treatment`} variant="ghost">
                {t('patients.treatmentPlans')}
              </LinkButton>
            }
          >
            {patient.needsReassessment && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>
                  {patient.latestAssessment
                    ? t('patients.reassessmentDueLast', { date: formatDate(patient.latestAssessment.assessedAt) })
                    : t('patients.reassessmentDueNone')}
                </span>
                <Link href={`${base}/assessment`} className="font-medium underline">
                  {t('patients.openAssessment')}
                </Link>
              </div>
            )}
            {patient.activePlan ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <p className="text-lg font-semibold">{patient.activePlan.title}</p>
                  {patient.activePlan.primaryObjective && <p className="text-slate-600">{patient.activePlan.primaryObjective}</p>}
                </div>
                <Info label={t('common.status')}>
                  <StatusBadge status={patient.activePlan.status} tones={planStatusTone} />
                </Info>
                <Info label={t('patients.started')}>{formatDay(patient.activePlan.startDate)}</Info>
                <Info label={t('patients.reviewDate')}>{formatDay(patient.activePlan.reviewDate)}</Info>
                <Info label={t('patients.frequency')}>{patient.activePlan.recommendedFrequency ?? '—'}</Info>
                <Info label={t('patients.expectedDuration')}>{patient.activePlan.expectedDuration ?? '—'}</Info>
                <Info label={t('patients.lastAssessment')}>
                  {patient.latestAssessment ? formatDate(patient.latestAssessment.assessedAt) : t('common.none')}
                </Info>
              </div>
            ) : (
              <EmptyState
                title={t('patients.noActivePlan')}
                description={t('patients.noActivePlanDescription')}
                action={can(me.role, 'treatment.edit') && <LinkButton href={`${base}/treatment`}>{t('patients.createTreatmentPlan')}</LinkButton>}
              />
            )}
          </Card>
        )}

        {patient.clinicalAccess && (
          <Card
            title={
              <div>
                <h2>{t('patients.currentGoals')}</h2>
                {avg !== null && (
                  <p className="text-sm text-slate-500">
                    {t(goals.length === 1 ? 'patients.goalsSummaryOne' : 'patients.goalsSummaryOther', { avg, achieved, total: goals.length })}
                  </p>
                )}
              </div>
            }
            actions={
              <LinkButton href={`${base}/progress`} variant="ghost">
                {t('patients.charts')}
              </LinkButton>
            }
          >
            {goals.length === 0 ? (
              <p className="text-sm text-slate-500">{t('patients.noGoals')}</p>
            ) : (
              <ul className="space-y-6">
                {goals.map((g) => (
                  <li key={g.id}>
                    <GoalProgress goal={g} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {patient.clinicalAccess && (
          <Card
            title={t('patients.recentSessions')}
            actions={
              <LinkButton href={`${base}/sessions`} variant="ghost">
                {t('patients.allSessions')}
              </LinkButton>
            }
          >
            {patient.recentSessions.length === 0 ? (
              <p className="text-sm text-slate-500">{t('patients.noSessions')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {patient.recentSessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sessions/${s.id}`} className="flex min-h-touch flex-wrap items-center justify-between gap-2 py-3 hover:text-primary-700">
                      <span>
                        <span className="font-medium">{formatDate(s.sessionDate)}</span>
                        <span className="text-sm text-slate-500">
                          {' '}
                          · {s.therapist.fullName}
                          {s._count && ` · ${t('patients.sessionCounts', { exercises: s._count.exercises, measurements: s._count.measurements })}`}
                        </span>
                        {s.notes && <span className="block max-w-xl truncate text-sm text-slate-500">{s.notes}</span>}
                      </span>
                      <StatusBadge status={s.status} tones={sessionStatusTone} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card
          title={t('patients.patient')}
          actions={
            can(me.role, 'patient.edit') && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </Button>
            )
          }
        >
          <dl className="grid grid-cols-2 gap-4">
            <Info label={t('patients.patientCode')}>{patient.patientCode}</Info>
            <Info label={t('patients.dateOfBirth')}>{formatDay(patient.dateOfBirth)}</Info>
            <Info label={t('patients.age')}>{t('patients.ageYears', { age: patient.age })}</Info>
            <Info label={t('patients.gender')}>{humanize(patient.gender)}</Info>
            <Info label={t('patients.primaryTherapist')} wide>
              {patient.primaryTherapist?.fullName ?? <span className="text-slate-400">{t('patients.unassigned')}</span>}
            </Info>
            {patient.medicalNotes && (
              <Info label={t('patients.medicalNotes')} wide>
                <span className="whitespace-pre-line">{patient.medicalNotes}</span>
              </Info>
            )}
          </dl>
        </Card>

        <Card title={t('patients.nextAppointment')}>
          {patient.nextAppointment ? (
            <div>
              <p className="text-lg font-semibold">{formatDateTime(patient.nextAppointment.startAt)}</p>
              <p className="text-sm text-slate-500">
                {t('patients.durationTherapist', { minutes: patient.nextAppointment.durationMinutes, therapist: patient.nextAppointment.therapist.fullName })}
              </p>
              <Badge tone="blue" className="mt-2">
                {humanize(patient.nextAppointment.status)}
              </Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">{t('patients.noUpcomingAppointment')}</p>
              {can(me.role, 'appointment.edit') && (
                <LinkButton href={`/calendar?patientId=${id}`} variant="secondary">
                  {t('patients.schedule')}
                </LinkButton>
              )}
            </div>
          )}
        </Card>

        <DiagnosesCard patientId={id} diagnoses={patient.diagnoses} />
        <GuardiansCard patientId={id} guardians={patient.guardians} />
      </div>

      <EditPatientModal patient={patient} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-full' : undefined}>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </div>
  );
}
