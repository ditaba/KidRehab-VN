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

export default function PatientOverviewPage() {
  const id = usePatientId();
  const me = useMe();
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
                Start session
              </Button>
            )}
            <LinkButton href={`${base}/progress`} variant="secondary">
              View progress
            </LinkButton>
            {start.error && <p className="w-full text-sm text-red-600">{errorMessage(start.error)}</p>}
          </div>
        )}

        {patient.clinicalAccess && (
          <Card
            title="Treatment status"
            actions={
              <LinkButton href={`${base}/treatment`} variant="ghost">
                Treatment plans
              </LinkButton>
            }
          >
            {patient.needsReassessment && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>
                  Reassessment due —{' '}
                  {patient.latestAssessment ? `last assessed ${formatDate(patient.latestAssessment.assessedAt)}` : 'no assessment on file'}.
                </span>
                <Link href={`${base}/assessment`} className="font-medium underline">
                  Open assessment
                </Link>
              </div>
            )}
            {patient.activePlan ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <p className="text-lg font-semibold">{patient.activePlan.title}</p>
                  {patient.activePlan.primaryObjective && <p className="text-slate-600">{patient.activePlan.primaryObjective}</p>}
                </div>
                <Info label="Status">
                  <StatusBadge status={patient.activePlan.status} tones={planStatusTone} />
                </Info>
                <Info label="Started">{formatDay(patient.activePlan.startDate)}</Info>
                <Info label="Review date">{formatDay(patient.activePlan.reviewDate)}</Info>
                <Info label="Frequency">{patient.activePlan.recommendedFrequency ?? '—'}</Info>
                <Info label="Expected duration">{patient.activePlan.expectedDuration ?? '—'}</Info>
                <Info label="Last assessment">
                  {patient.latestAssessment ? formatDate(patient.latestAssessment.assessedAt) : 'None'}
                </Info>
              </div>
            ) : (
              <EmptyState
                title="No active treatment plan"
                description="Create a treatment plan with measurable goals to start tracking progress."
                action={can(me.role, 'treatment.edit') && <LinkButton href={`${base}/treatment`}>Create treatment plan</LinkButton>}
              />
            )}
          </Card>
        )}

        {patient.clinicalAccess && (
          <Card
            title={
              <div>
                <h2>Current goals & progress</h2>
                {avg !== null && (
                  <p className="text-sm text-slate-500">
                    Average {avg}% toward target · {achieved} of {goals.length} goal{goals.length === 1 ? '' : 's'} reached
                  </p>
                )}
              </div>
            }
            actions={
              <LinkButton href={`${base}/progress`} variant="ghost">
                Charts
              </LinkButton>
            }
          >
            {goals.length === 0 ? (
              <p className="text-sm text-slate-500">No goals defined yet.</p>
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
            title="Recent sessions"
            actions={
              <LinkButton href={`${base}/sessions`} variant="ghost">
                All sessions
              </LinkButton>
            }
          >
            {patient.recentSessions.length === 0 ? (
              <p className="text-sm text-slate-500">No sessions documented yet.</p>
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
                          {s._count && ` · ${s._count.exercises} exercises · ${s._count.measurements} measurements`}
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
          title="Patient"
          actions={
            can(me.role, 'patient.edit') && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )
          }
        >
          <dl className="grid grid-cols-2 gap-4">
            <Info label="Patient code">{patient.patientCode}</Info>
            <Info label="Date of birth">{formatDay(patient.dateOfBirth)}</Info>
            <Info label="Age">{patient.age} years</Info>
            <Info label="Gender">{humanize(patient.gender)}</Info>
            <Info label="Primary therapist" wide>
              {patient.primaryTherapist?.fullName ?? <span className="text-slate-400">Unassigned</span>}
            </Info>
            {patient.medicalNotes && (
              <Info label="Medical notes" wide>
                <span className="whitespace-pre-line">{patient.medicalNotes}</span>
              </Info>
            )}
          </dl>
        </Card>

        <Card title="Next appointment">
          {patient.nextAppointment ? (
            <div>
              <p className="text-lg font-semibold">{formatDateTime(patient.nextAppointment.startAt)}</p>
              <p className="text-sm text-slate-500">
                {patient.nextAppointment.durationMinutes} min · {patient.nextAppointment.therapist.fullName}
              </p>
              <Badge tone="blue" className="mt-2">
                {humanize(patient.nextAppointment.status)}
              </Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">No upcoming appointment.</p>
              {can(me.role, 'appointment.edit') && (
                <LinkButton href={`/calendar?patientId=${id}`} variant="secondary">
                  Schedule
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
