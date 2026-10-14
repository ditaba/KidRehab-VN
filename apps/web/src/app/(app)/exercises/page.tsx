'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, Input, Loading, Modal, NoAccess, PageHeader, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatPrescription, humanize } from '@/lib/format';
import { MessageKey, useT } from '@/lib/i18n';
import { EXERCISE_CATEGORIES } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { Exercise, ExerciseCategory } from '@/lib/types';

const makeSchema = (t: (key: MessageKey) => string) => {
  const optionalInt = z.union([z.literal(''), z.coerce.number().int(t('exercises.wholeNumber')).min(0, t('exercises.mustBeNonNegative'))]);
  return z.object({
    name: z.string().trim().min(1, t('exercises.nameRequired')).max(150),
    category: z.enum(EXERCISE_CATEGORIES as [ExerciseCategory, ...ExerciseCategory[]]),
    description: z.string().max(2000),
    instructions: z.string().max(5000),
    defaultSets: optionalInt,
    defaultRepetitions: optionalInt,
    defaultDurationSeconds: optionalInt,
  });
};
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export default function ExercisesPage() {
  const me = useMe();
  const t = useT();
  const canEdit = can(me.role, 'exercise.edit');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const qc = useQueryClient();
  const allowed = can(me.role, 'clinical.view');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exercises', 'all'],
    queryFn: () => api<Exercise[]>('/exercises'),
    enabled: allowed,
  });
  const toggle = useMutation({
    mutationFn: (e: Exercise) => api(`/exercises/${e.id}`, { method: 'PATCH', body: { status: e.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });

  if (!allowed) return <NoAccess />;

  const list = (data ?? []).filter(
    (e) =>
      (showDisabled || e.status === 'ACTIVE') &&
      (!category || e.category === category) &&
      (!search || e.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title={t('exercises.title')}
        subtitle={t('exercises.subtitle')}
        actions={canEdit && <Button onClick={() => setEditing('new')}>{t('exercises.newExercise')}</Button>}
      />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Input type="search" placeholder={t('exercises.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('common.search')} />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory | '')} aria-label={t('exercises.category')}>
          <option value="">{t('exercises.allCategories')}</option>
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </Select>
        <label className="flex min-h-touch items-center gap-3 text-sm text-slate-600">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
          {t('exercises.showDisabled')}
        </label>
      </div>
      {toggle.error && <FormError message={errorMessage(toggle.error)} />}
      {isLoading && <Loading />}
      {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && list.length === 0 && (
        <EmptyState
          title={data.length === 0 ? t('exercises.libraryEmpty') : t('exercises.noMatch')}
          action={canEdit && data.length === 0 && <Button onClick={() => setEditing('new')}>{t('exercises.addFirst')}</Button>}
        />
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <li key={e.id} className={`card flex flex-col p-5 ${e.status === 'DISABLED' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{e.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{humanize(e.category)}</Badge>
                  {e.status === 'DISABLED' && <Badge tone="slate">{t('exercises.disabled')}</Badge>}
                </div>
              </div>
              <span className="whitespace-nowrap text-sm font-medium text-slate-600">
                {formatPrescription({ sets: e.defaultSets, repetitions: e.defaultRepetitions, durationSeconds: e.defaultDurationSeconds })}
              </span>
            </div>
            {e.description && <p className="mt-3 text-sm text-slate-600">{e.description}</p>}
            {e.instructions && <p className="mt-2 whitespace-pre-line text-sm text-slate-500">{e.instructions}</p>}
            <div className="mt-auto flex items-center justify-between pt-4 text-sm text-slate-500">
              <span>{t(e._count?.sessionExercises === 1 ? 'exercises.usedInOne' : 'exercises.usedInOther', { count: e._count?.sessionExercises ?? 0 })}</span>
              {canEdit && (
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" loading={toggle.isPending && toggle.variables?.id === e.id} onClick={() => toggle.mutate(e)}>
                    {e.status === 'ACTIVE' ? t('exercises.disable') : t('exercises.enable')}
                  </Button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing && <ExerciseModal exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ExerciseModal({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: exercise?.name ?? '',
      category: exercise?.category ?? 'BALANCE',
      description: exercise?.description ?? '',
      instructions: exercise?.instructions ?? '',
      defaultSets: exercise?.defaultSets ?? '',
      defaultRepetitions: exercise?.defaultRepetitions ?? '',
      defaultDurationSeconds: exercise?.defaultDurationSeconds ?? '',
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        ...v,
        defaultSets: v.defaultSets === '' ? null : v.defaultSets,
        defaultRepetitions: v.defaultRepetitions === '' ? null : v.defaultRepetitions,
        defaultDurationSeconds: v.defaultDurationSeconds === '' ? null : v.defaultDurationSeconds,
      };
      return exercise ? api(`/exercises/${exercise.id}`, { method: 'PATCH', body }) : api('/exercises', { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      onClose();
    },
  });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={exercise ? t('exercises.editExercise') : t('exercises.newExercise')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="exercise-form" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="exercise-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label={t('exercises.name')} required error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label={t('exercises.category')}>
          <Select {...register('category')}>
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label={t('exercises.defaultSets')} error={errors.defaultSets?.message}>
            <Input type="number" inputMode="numeric" min={0} {...register('defaultSets')} />
          </Field>
          <Field label={t('exercises.defaultReps')} error={errors.defaultRepetitions?.message}>
            <Input type="number" inputMode="numeric" min={0} {...register('defaultRepetitions')} />
          </Field>
          <Field label={t('exercises.durationSeconds')} error={errors.defaultDurationSeconds?.message}>
            <Input type="number" inputMode="numeric" min={0} {...register('defaultDurationSeconds')} />
          </Field>
        </div>
        <Field label={t('exercises.description')} className="sm:col-span-2">
          <Textarea rows={2} {...register('description')} />
        </Field>
        <Field label={t('exercises.instructions')} className="sm:col-span-2">
          <Textarea rows={4} {...register('instructions')} />
        </Field>
      </form>
    </Modal>
  );
}
