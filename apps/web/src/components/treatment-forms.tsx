'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, FormError, Input, Modal, ProgressBar, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { humanize, toInputDate } from '@/lib/format';
import { GOAL_STATUSES, PLAN_STATUSES } from '@/lib/labels';
import { progressPercent } from '@/lib/progress';
import type { Goal, TreatmentPlan } from '@/lib/types';

function invalidate(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['treatment-plans', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] });
  qc.invalidateQueries({ queryKey: ['progress', patientId] });
}

// ---- Plan --------------------------------------------------------------------

const planSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    primaryObjective: z.string().max(2000),
    startDate: z.string().min(1, 'Start date is required'),
    reviewDate: z.string(),
    recommendedFrequency: z.string().max(100),
    expectedDuration: z.string().max(100),
    notes: z.string().max(5000),
    status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  })
  .refine((v) => !v.reviewDate || v.reviewDate >= v.startDate, { path: ['reviewDate'], message: 'Review date must be after the start date' });
type PlanValues = z.infer<typeof planSchema>;

export function PlanModal({
  patientId,
  plan,
  hasActive,
  onClose,
}: {
  patientId: string;
  plan: TreatmentPlan | null;
  hasActive: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: plan?.title ?? '',
      primaryObjective: plan?.primaryObjective ?? '',
      startDate: plan?.startDate.slice(0, 10) ?? toInputDate(new Date()),
      reviewDate: plan?.reviewDate?.slice(0, 10) ?? '',
      recommendedFrequency: plan?.recommendedFrequency ?? '',
      expectedDuration: plan?.expectedDuration ?? '',
      notes: plan?.notes ?? '',
      status: plan?.status ?? 'ACTIVE',
    },
  });
  const status = useWatch({ control, name: 'status' });
  const save = useMutation({
    mutationFn: (v: PlanValues) => {
      const body = { ...v, reviewDate: v.reviewDate || undefined };
      return plan
        ? api(`/treatment-plans/${plan.id}`, { method: 'PATCH', body })
        : api(`/patients/${patientId}/treatment-plans`, { method: 'POST', body });
    },
    onSuccess: () => {
      invalidate(qc, patientId);
      onClose();
    },
  });

  const willSupersede = status === 'ACTIVE' && hasActive && plan?.status !== 'ACTIVE';

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={plan ? 'Edit treatment plan' : 'New treatment plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={save.isPending}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label="Title" required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} placeholder="e.g. Standing & walking independence" />
        </Field>
        <Field label="Primary objective" className="sm:col-span-2">
          <Textarea rows={2} {...register('primaryObjective')} />
        </Field>
        <Field label="Start date" required error={errors.startDate?.message}>
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label="Review date" error={errors.reviewDate?.message}>
          <Input type="date" {...register('reviewDate')} />
        </Field>
        <Field label="Recommended frequency">
          <Input {...register('recommendedFrequency')} placeholder="3 sessions / week" />
        </Field>
        <Field label="Expected duration">
          <Input {...register('expectedDuration')} placeholder="6 months" />
        </Field>
        <Field label="Status" hint={willSupersede ? 'The current active plan will be marked Completed.' : undefined}>
          <Select {...register('status')}>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}

// ---- Goal --------------------------------------------------------------------

const goalSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().max(2000),
    metricName: z.string().trim().max(120),
    unit: z.string().trim().min(1, 'Unit is required').max(30),
    direction: z.enum(['INCREASE_IS_BETTER', 'DECREASE_IS_BETTER']),
    baselineValue: z.coerce.number({ invalid_type_error: 'Baseline is required' }),
    targetValue: z.coerce.number({ invalid_type_error: 'Target is required' }),
    targetDate: z.string(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PAUSED', 'CANCELLED']),
  })
  .refine((v) => (v.direction === 'INCREASE_IS_BETTER' ? v.targetValue > v.baselineValue : v.targetValue < v.baselineValue), {
    path: ['targetValue'],
    message: 'Target must improve on the baseline in the chosen direction',
  });
type GoalValues = z.infer<typeof goalSchema>;

export function GoalModal({ patientId, planId, goal, onClose }: { patientId: string; planId: string; goal: Goal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description ?? '',
          metricName: goal.metricName,
          unit: goal.unit,
          direction: goal.direction,
          baselineValue: goal.baselineValue,
          targetValue: goal.targetValue,
          targetDate: goal.targetDate?.slice(0, 10) ?? '',
          status: goal.status,
        }
      : { description: '', metricName: '', unit: '', direction: 'INCREASE_IS_BETTER', targetDate: '', status: 'NOT_STARTED' },
  });
  const [baseline, target, direction] = useWatch({ control, name: ['baselineValue', 'targetValue', 'direction'] });

  const save = useMutation({
    mutationFn: (v: GoalValues) => {
      const body = { ...v, metricName: v.metricName || v.title, targetDate: v.targetDate || undefined };
      return goal ? api(`/goals/${goal.id}`, { method: 'PATCH', body }) : api(`/treatment-plans/${planId}/goals`, { method: 'POST', body });
    },
    onSuccess: () => {
      invalidate(qc, patientId);
      onClose();
    },
  });

  const preview =
    goal && Number.isFinite(Number(baseline)) && Number.isFinite(Number(target))
      ? progressPercent(Number(baseline), Number(target), goal.currentValue ?? Number(baseline), direction)
      : null;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New measurable goal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-form" loading={save.isPending}>
            Save goal
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label="Goal" required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} placeholder="Stand independently" />
        </Field>
        <Field label="Metric" hint="What you will measure each session. Defaults to the goal title." className="sm:col-span-2">
          <Input {...register('metricName')} placeholder="Standing Duration" />
        </Field>
        <Field label="Baseline" required error={errors.baselineValue?.message}>
          <Input type="number" step="any" inputMode="decimal" {...register('baselineValue')} placeholder="5" />
        </Field>
        <Field label="Target" required error={errors.targetValue?.message}>
          <Input type="number" step="any" inputMode="decimal" {...register('targetValue')} placeholder="30" />
        </Field>
        <Field label="Unit" required error={errors.unit?.message}>
          <Input {...register('unit')} placeholder="seconds" list="unit-suggestions" />
          <datalist id="unit-suggestions">
            {['seconds', 'm', 'reps', '°', 'steps', 'cm', 'points', '%'].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="Improvement direction">
          <Select {...register('direction')}>
            <option value="INCREASE_IS_BETTER">Higher is better</option>
            <option value="DECREASE_IS_BETTER">Lower is better</option>
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="date" {...register('targetDate')} />
        </Field>
        <Field label="Status">
          <Select {...register('status')}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={2} {...register('description')} />
        </Field>
        {preview !== null && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm text-slate-500">Progress with current value: {preview}%</p>
            <ProgressBar percent={preview} />
          </div>
        )}
      </form>
    </Modal>
  );
}
