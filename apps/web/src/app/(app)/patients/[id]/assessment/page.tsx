'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Button, Card, EmptyState, ErrorState, Field, FormError, Input, Loading, NoAccess, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, humanize, toInputDate } from '@/lib/format';
import { usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import type { Assessment } from '@/lib/types';
import { MessageKey, useT } from '@/lib/i18n';

const SECTIONS = [
  ['medicalHistory', 'assessment.medicalHistory'],
  ['developmentHistory', 'assessment.developmentHistory'],
  ['functionalAbility', 'assessment.functionalAbility'],
  ['rangeOfMotion', 'assessment.rangeOfMotion'],
  ['strength', 'assessment.strength'],
  ['balance', 'assessment.balance'],
  ['gait', 'assessment.gait'],
] as const satisfies readonly (readonly [string, MessageKey])[];

const makeSchema = (t: (key: MessageKey) => string) =>
  z.object({
    type: z.enum(['INITIAL', 'REASSESSMENT']),
    assessedAt: z.string().min(1, t('common.required')),
    medicalHistory: z.string().max(10000),
    developmentHistory: z.string().max(10000),
    functionalAbility: z.string().max(10000),
    rangeOfMotion: z.string().max(10000),
    strength: z.string().max(10000),
    balance: z.string().max(10000),
    gait: z.string().max(10000),
    painScore: z.union([z.literal(''), z.coerce.number().int().min(0, t('assessment.painRange')).max(10, t('assessment.painRange'))]),
    pain: z.string().max(10000),
    clinicalNotes: z.string().max(10000),
  });
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export default function AssessmentPage() {
  const id = usePatientId();
  const me = useMe();
  const t = useT();
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assessments', id],
    queryFn: () => api<Assessment[]>(`/patients/${id}/assessments`),
    enabled: can(me.role, 'clinical.view'),
  });

  if (!can(me.role, 'clinical.view')) return <NoAccess />;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const canEdit = can(me.role, 'assessment.edit');

  if (editing) {
    return (
      <AssessmentForm
        patientId={id}
        assessment={editing === 'new' ? null : editing}
        isFirst={!data?.length}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-500">{t('assessment.intro')}</p>
        {canEdit && <Button onClick={() => setEditing('new')}>{data?.length ? t('assessment.newReassessment') : t('assessment.initialAssessment')}</Button>}
      </div>
      {!data?.length ? (
        <EmptyState
          title={t('assessment.emptyTitle')}
          description={canEdit ? t('assessment.emptyDescriptionEditor') : t('assessment.emptyDescriptionViewer')}
        />
      ) : (
        data.map((a, i) => {
          const expanded = openId ? openId === a.id : i === 0;
          return (
            <Card
              key={a.id}
              title={
                <button className="text-left" onClick={() => setOpenId(expanded ? '' : a.id)} aria-expanded={expanded}>
                  <h2>
                    {t(a.type === 'INITIAL' ? 'assessment.cardTitleInitial' : 'assessment.cardTitleReassessment', { date: formatDate(a.assessedAt) })}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {t('assessment.byline', { author: a.author.fullName, created: formatDateTime(a.createdAt) })}
                    {a.updatedAt !== a.createdAt && t('assessment.updatedSuffix', { updated: formatDateTime(a.updatedAt) })}
                  </p>
                </button>
              }
              actions={
                <>
                  {i === 0 && <Badge tone="green">{t('assessment.latest')}</Badge>}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                      {t('common.edit')}
                    </Button>
                  )}
                </>
              }
            >
              {expanded ? (
                <dl className="grid gap-5 md:grid-cols-2">
                  {SECTIONS.map(([key, label]) => (
                    <Section key={key} label={t(label)} value={a[key]} />
                  ))}
                  <Section
                    label={t('assessment.pain')}
                    value={[a.painScore !== null ? t('assessment.painScore', { score: a.painScore }) : null, a.pain].filter(Boolean).join(' — ')}
                  />
                  <Section label={t('assessment.clinicalNotes')} value={a.clinicalNotes} wide />
                </dl>
              ) : (
                <button className="text-sm text-primary-700" onClick={() => setOpenId(a.id)}>
                  {t('assessment.showDetails')}
                </button>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function Section({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  const t = useT();
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-slate-800">{value || <span className="text-slate-400">{t('assessment.notDocumented')}</span>}</dd>
    </div>
  );
}

function AssessmentForm({
  patientId,
  assessment,
  isFirst,
  onDone,
}: {
  patientId: string;
  assessment: Assessment | null;
  isFirst: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: assessment?.type ?? (isFirst ? 'INITIAL' : 'REASSESSMENT'),
      assessedAt: assessment ? assessment.assessedAt.slice(0, 10) : toInputDate(new Date()),
      medicalHistory: assessment?.medicalHistory ?? '',
      developmentHistory: assessment?.developmentHistory ?? '',
      functionalAbility: assessment?.functionalAbility ?? '',
      rangeOfMotion: assessment?.rangeOfMotion ?? '',
      strength: assessment?.strength ?? '',
      balance: assessment?.balance ?? '',
      gait: assessment?.gait ?? '',
      painScore: assessment?.painScore ?? '',
      pain: assessment?.pain ?? '',
      clinicalNotes: assessment?.clinicalNotes ?? '',
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = { ...v, painScore: v.painScore === '' ? undefined : v.painScore };
      return assessment
        ? api(`/assessments/${assessment.id}`, { method: 'PATCH', body })
        : api(`/patients/${patientId}/assessments`, { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessments', patientId] });
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
      <Card title={assessment ? t('assessment.editTitle') : t('assessment.newTitle')}>
        <div className="space-y-5">
          <FormError message={save.error ? errorMessage(save.error) : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('assessment.type')}>
              <Select {...register('type')}>
                <option value="INITIAL">{humanize('INITIAL')}</option>
                <option value="REASSESSMENT">{humanize('REASSESSMENT')}</option>
              </Select>
            </Field>
            <Field label={t('assessment.assessmentDate')} required error={errors.assessedAt?.message}>
              <Input type="date" max={toInputDate(new Date())} {...register('assessedAt')} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.map(([key, label]) => (
              <Field key={key} label={t(label)}>
                <Textarea rows={3} {...register(key)} />
              </Field>
            ))}
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field label={t('assessment.painScoreLabel')} error={errors.painScore?.message}>
                <Input type="number" inputMode="numeric" min={0} max={10} {...register('painScore')} />
              </Field>
              <Field label={t('assessment.painDescription')}>
                <Input {...register('pain')} />
              </Field>
            </div>
          </div>
          <Field label={t('assessment.clinicalNotes')}>
            <Textarea rows={4} {...register('clinicalNotes')} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" loading={save.isPending}>
          {t('assessment.saveAssessment')}
        </Button>
      </div>
    </form>
  );
}
