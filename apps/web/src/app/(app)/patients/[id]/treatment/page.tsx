'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { GoalProgress } from '@/components/goal-progress';
import { GoalModal, PlanModal } from '@/components/treatment-forms';
import { Button, Card, EmptyState, ErrorState, Loading, NoAccess, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDay } from '@/lib/format';
import { planStatusTone } from '@/lib/labels';
import { usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import type { Goal, TreatmentPlan } from '@/lib/types';

export default function TreatmentPage() {
  const id = usePatientId();
  const me = useMe();
  const canEdit = can(me.role, 'treatment.edit');
  const [planModal, setPlanModal] = useState<TreatmentPlan | 'new' | null>(null);
  const [goalModal, setGoalModal] = useState<{ planId: string; goal: Goal | null } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['treatment-plans', id],
    queryFn: () => api<TreatmentPlan[]>(`/patients/${id}/treatment-plans`),
    enabled: can(me.role, 'clinical.view'),
  });

  if (!can(me.role, 'clinical.view')) return <NoAccess />;
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const hasActive = data.some((p) => p.status === 'ACTIVE');
  const current = data.filter((p) => p.status === 'ACTIVE' || p.status === 'DRAFT');
  const history = data.filter((p) => p.status === 'COMPLETED' || p.status === 'CANCELLED');
  const visible = showHistory ? [...current, ...history] : current;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-500">
          {data.length} plan{data.length === 1 ? '' : 's'} on record
          {history.length > 0 && (
            <button className="ml-2 text-primary-700 underline-offset-2 hover:underline" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? 'Hide history' : `Show ${history.length} historical`}
            </button>
          )}
        </p>
        {canEdit && <Button onClick={() => setPlanModal('new')}>New treatment plan</Button>}
      </div>

      {visible.length === 0 && (
        <EmptyState
          title="No active treatment plan"
          description={canEdit ? 'Create a plan, then add measurable goals (baseline, target, unit).' : 'A doctor has not created a treatment plan yet.'}
          action={canEdit && <Button onClick={() => setPlanModal('new')}>Create treatment plan</Button>}
        />
      )}

      {visible.map((plan) => (
        <Card
          key={plan.id}
          className={plan.status === 'COMPLETED' || plan.status === 'CANCELLED' ? 'opacity-80' : undefined}
          title={
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2>{plan.title}</h2>
                <StatusBadge status={plan.status} tones={planStatusTone} />
              </div>
              <p className="text-sm text-slate-500">
                {formatDay(plan.startDate)} → review {formatDay(plan.reviewDate)}
                {plan.recommendedFrequency && ` · ${plan.recommendedFrequency}`}
                {plan.expectedDuration && ` · ${plan.expectedDuration}`}
              </p>
            </div>
          }
          actions={
            canEdit && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setPlanModal(plan)}>
                  Edit plan
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setGoalModal({ planId: plan.id, goal: null })}>
                  + Add goal
                </Button>
              </>
            )
          }
        >
          {plan.primaryObjective && <p className="mb-4 text-slate-700">{plan.primaryObjective}</p>}
          {plan.goals.length === 0 ? (
            <EmptyState
              title="No goals yet"
              description="Add at least one measurable goal so progress can be tracked."
              action={canEdit && <Button onClick={() => setGoalModal({ planId: plan.id, goal: null })}>Add goal</Button>}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {plan.goals.map((g) => (
                <li key={g.id} className="rounded-xl border border-slate-200 p-4">
                  <GoalProgress goal={g} />
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                    <span>Deadline: {formatDay(g.targetDate)}</span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setGoalModal({ planId: plan.id, goal: g })}>
                        Edit goal
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {plan.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{plan.notes}</p>}
        </Card>
      ))}

      {planModal && (
        <PlanModal patientId={id} plan={planModal === 'new' ? null : planModal} hasActive={hasActive} onClose={() => setPlanModal(null)} />
      )}
      {goalModal && <GoalModal patientId={id} planId={goalModal.planId} goal={goalModal.goal} onClose={() => setGoalModal(null)} />}
    </div>
  );
}
