'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { z } from 'zod';
import { Button, Field, FormError, Input, Modal, ProgressBar, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { humanize, toInputDate } from '@/lib/format';
import { GOAL_STATUSES, PLAN_STATUSES } from '@/lib/labels';
import { progressPercent } from '@/lib/progress';
import type { Goal, TreatmentPlan } from '@/lib/types';
import { MessageKey, useT } from '@/lib/i18n';

function invalidate(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['treatment-plans', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] });
  qc.invalidateQueries({ queryKey: ['progress', patientId] });
}

// ---- Plan --------------------------------------------------------------------

const makePlanSchema = (t: (key: MessageKey) => string) =>
  z
    .object({
      title: z.string().trim().min(1, t('treatment.titleRequired')).max(200),
      primaryObjective: z.string().max(2000),
      startDate: z.string().min(1, t('treatment.startDateRequired')),
      reviewDate: z.string(),
      recommendedFrequency: z.string().max(100),
      expectedDuration: z.string().max(100),
      notes: z.string().max(5000),
      status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
    })
    .refine((v) => !v.reviewDate || v.reviewDate >= v.startDate, { path: ['reviewDate'], message: t('treatment.reviewAfterStart') });
type PlanValues = z.infer<ReturnType<typeof makePlanSchema>>;

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
  const t = useT();
  const planSchema = useMemo(() => makePlanSchema(t), [t]);
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
      title={plan ? t('treatment.editPlanTitle') : t('treatment.newPlan')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="plan-form" loading={save.isPending}>
            {t('treatment.savePlan')}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label={t('treatment.title')} required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} placeholder={t('treatment.titlePlaceholder')} />
        </Field>
        <Field label={t('treatment.primaryObjective')} className="sm:col-span-2">
          <Textarea rows={2} {...register('primaryObjective')} />
        </Field>
        <Field label={t('treatment.startDate')} required error={errors.startDate?.message}>
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label={t('treatment.reviewDate')} error={errors.reviewDate?.message}>
          <Input type="date" {...register('reviewDate')} />
        </Field>
        <Field label={t('treatment.recommendedFrequency')}>
          <Input {...register('recommendedFrequency')} placeholder={t('treatment.frequencyPlaceholder')} />
        </Field>
        <Field label={t('treatment.expectedDuration')}>
          <Input {...register('expectedDuration')} placeholder={t('treatment.durationPlaceholder')} />
        </Field>
        <Field label={t('common.status')} hint={willSupersede ? t('treatment.supersedeHint') : undefined}>
          <Select {...register('status')}>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.notes')} className="sm:col-span-2">
          <Textarea rows={3} {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}

// ---- Goal --------------------------------------------------------------------

const makeGoalSchema = (t: (key: MessageKey) => string) =>
  z
    .object({
      title: z.string().trim().min(1, t('treatment.titleRequired')).max(200),
      description: z.string().max(2000),
      metricName: z.string().trim().max(120),
      unit: z.string().trim().min(1, t('treatment.unitRequired')).max(30),
      direction: z.enum(['INCREASE_IS_BETTER', 'DECREASE_IS_BETTER']),
      baselineValue: z.coerce.number({ invalid_type_error: t('treatment.baselineRequired') }),
      targetValue: z.coerce.number({ invalid_type_error: t('treatment.targetRequired') }),
      targetDate: z.string(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PAUSED', 'CANCELLED']),
    })
    .refine((v) => (v.direction === 'INCREASE_IS_BETTER' ? v.targetValue > v.baselineValue : v.targetValue < v.baselineValue), {
      path: ['targetValue'],
      message: t('treatment.targetMustImprove'),
    });
type GoalValues = z.infer<ReturnType<typeof makeGoalSchema>>;

export function GoalModal({ patientId, planId, goal, onClose }: { patientId: string; planId: string; goal: Goal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT();
  const goalSchema = useMemo(() => makeGoalSchema(t), [t]);
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
      title={goal ? t('treatment.editGoal') : t('treatment.newGoal')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="goal-form" loading={save.isPending}>
            {t('treatment.saveGoal')}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label={t('treatment.goal')} required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} placeholder={t('treatment.goalPlaceholder')} />
        </Field>
        <Field label={t('treatment.metric')} hint={t('treatment.metricHint')} className="sm:col-span-2">
          <Input {...register('metricName')} placeholder={t('treatment.metricPlaceholder')} />
        </Field>
        <Field label={t('treatment.baseline')} required error={errors.baselineValue?.message}>
          <Input type="number" step="any" inputMode="decimal" {...register('baselineValue')} placeholder="5" />
        </Field>
        <Field label={t('treatment.target')} required error={errors.targetValue?.message}>
          <Input type="number" step="any" inputMode="decimal" {...register('targetValue')} placeholder="30" />
        </Field>
        <Field label={t('treatment.unit')} required error={errors.unit?.message}>
          <Input {...register('unit')} placeholder={t('treatment.unitPlaceholder')} list="unit-suggestions" />
          <datalist id="unit-suggestions">
            {[t('treatment.unitSeconds'), 'm', t('treatment.unitReps'), '°', t('treatment.unitSteps'), 'cm', t('treatment.unitPoints'), '%'].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label={t('treatment.improvementDirection')}>
          <Select {...register('direction')}>
            <option value="INCREASE_IS_BETTER">{humanize('INCREASE_IS_BETTER')}</option>
            <option value="DECREASE_IS_BETTER">{humanize('DECREASE_IS_BETTER')}</option>
          </Select>
        </Field>
        <Field label={t('treatment.deadline')}>
          <Input type="date" {...register('targetDate')} />
        </Field>
        <Field label={t('common.status')}>
          <Select {...register('status')}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('treatment.description')} className="sm:col-span-2">
          <Textarea rows={2} {...register('description')} />
        </Field>
        {preview !== null && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm text-slate-500">{t('treatment.previewProgress', { percent: preview })}</p>
            <ProgressBar percent={preview} />
          </div>
        )}
      </form>
    </Modal>
  );
}
