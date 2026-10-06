'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Button, Card, EmptyState, ErrorState, Field, FormError, Input, Loading, NoAccess, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime, humanize, toInputDate } from '@/lib/format';
import { usePatientId } from '@/lib/patient';
import { can } from '@/lib/permissions';
import type { Assessment } from '@/lib/types';

const SECTIONS = [
  ['medicalHistory', 'Medical History'],
  ['developmentHistory', 'Development History'],
  ['functionalAbility', 'Functional Ability'],
  ['rangeOfMotion', 'Range of Motion'],
  ['strength', 'Strength'],
  ['balance', 'Balance'],
  ['gait', 'Gait'],
] as const;

const schema = z.object({
  type: z.enum(['INITIAL', 'REASSESSMENT']),
  assessedAt: z.string().min(1, 'Required'),
  medicalHistory: z.string().max(10000),
  developmentHistory: z.string().max(10000),
  functionalAbility: z.string().max(10000),
  rangeOfMotion: z.string().max(10000),
  strength: z.string().max(10000),
  balance: z.string().max(10000),
  gait: z.string().max(10000),
  painScore: z.union([z.literal(''), z.coerce.number().int().min(0, '0–10').max(10, '0–10')]),
  pain: z.string().max(10000),
  clinicalNotes: z.string().max(10000),
});
type FormValues = z.infer<typeof schema>;

export default function AssessmentPage() {
  const id = usePatientId();
  const me = useMe();
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
        <p className="text-slate-500">Clinical assessments establish the measurable baseline for treatment.</p>
        {canEdit && <Button onClick={() => setEditing('new')}>{data?.length ? 'New reassessment' : 'Initial assessment'}</Button>}
      </div>
      {!data?.length ? (
        <EmptyState
          title="No assessment yet"
          description={canEdit ? 'Document the initial condition to set the treatment baseline.' : 'A doctor has not documented an assessment yet.'}
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
                    {humanize(a.type)} assessment · {formatDate(a.assessedAt)}
                  </h2>
                  <p className="text-sm text-slate-500">
                    By {a.author.fullName} · created {formatDateTime(a.createdAt)}
                    {a.updatedAt !== a.createdAt && ` · updated ${formatDateTime(a.updatedAt)}`}
                  </p>
                </button>
              }
              actions={
                <>
                  {i === 0 && <Badge tone="green">Latest</Badge>}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  )}
                </>
              }
            >
              {expanded ? (
                <dl className="grid gap-5 md:grid-cols-2">
                  {SECTIONS.map(([key, label]) => (
                    <Section key={key} label={label} value={a[key]} />
                  ))}
                  <Section label="Pain" value={[a.painScore !== null ? `Score ${a.painScore}/10` : null, a.pain].filter(Boolean).join(' — ')} />
                  <Section label="Clinical Notes" value={a.clinicalNotes} wide />
                </dl>
              ) : (
                <button className="text-sm text-primary-700" onClick={() => setOpenId(a.id)}>
                  Show details
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
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-slate-800">{value || <span className="text-slate-400">Not documented</span>}</dd>
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
      <Card title={assessment ? 'Edit assessment' : 'New assessment'}>
        <div className="space-y-5">
          <FormError message={save.error ? errorMessage(save.error) : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select {...register('type')}>
                <option value="INITIAL">Initial</option>
                <option value="REASSESSMENT">Reassessment</option>
              </Select>
            </Field>
            <Field label="Assessment date" required error={errors.assessedAt?.message}>
              <Input type="date" max={toInputDate(new Date())} {...register('assessedAt')} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.map(([key, label]) => (
              <Field key={key} label={label}>
                <Textarea rows={3} {...register(key)} />
              </Field>
            ))}
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field label="Pain (0–10)" error={errors.painScore?.message}>
                <Input type="number" inputMode="numeric" min={0} max={10} {...register('painScore')} />
              </Field>
              <Field label="Pain description">
                <Input {...register('pain')} />
              </Field>
            </div>
          </div>
          <Field label="Clinical Notes">
            <Textarea rows={4} {...register('clinicalNotes')} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={save.isPending}>
          Save assessment
        </Button>
      </div>
    </form>
  );
}
