'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { guardianSchema, GuardianForm } from '@/components/guardian-fields';
import { Badge, Button, Card, Field, FormError, Input, Modal, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { RELATIONSHIPS } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { Guardian } from '@/lib/types';

export function GuardiansCard({ patientId, guardians }: { patientId: string; guardians: Guardian[] }) {
  const me = useMe();
  const editable = can(me.role, 'guardian.edit');
  const [editing, setEditing] = useState<Guardian | 'new' | null>(null);

  return (
    <Card
      title="Guardians"
      actions={
        editable && (
          <Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
            + Add
          </Button>
        )
      }
    >
      <ul className="space-y-4">
        {guardians.map((g) => (
          <li key={g.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">
                {g.fullName} {g.isPrimary && <Badge tone="blue">Primary</Badge>}
              </p>
              <p className="text-sm text-slate-500">{g.relationship}</p>
              <p className="text-sm">
                <a href={`tel:${g.phone.replace(/\s/g, '')}`} className="text-primary-700">
                  {g.phone}
                </a>
                {g.email && <span className="text-slate-500"> · {g.email}</span>}
              </p>
            </div>
            {editable && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                Edit
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <GuardianModal patientId={patientId} guardian={editing === 'new' ? null : editing} canDelete={guardians.length > 1} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function GuardianModal({
  patientId,
  guardian,
  canDelete,
  onClose,
}: {
  patientId: string;
  guardian: Guardian | null;
  canDelete: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuardianForm>({
    resolver: zodResolver(guardianSchema),
    defaultValues: guardian
      ? {
          fullName: guardian.fullName,
          relationship: guardian.relationship as GuardianForm['relationship'],
          phone: guardian.phone,
          email: guardian.email ?? '',
          isPrimary: guardian.isPrimary,
        }
      : { relationship: 'Mother', email: '', isPrimary: false },
  });
  const done = () => {
    qc.invalidateQueries({ queryKey: ['patient', patientId] });
    onClose();
  };
  const save = useMutation({
    mutationFn: (v: GuardianForm) =>
      guardian
        ? api(`/guardians/${guardian.id}`, { method: 'PATCH', body: v })
        : api(`/patients/${patientId}/guardians`, { method: 'POST', body: { ...v, email: v.email || undefined } }),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api(`/guardians/${guardian!.id}`, { method: 'DELETE' }), onSuccess: done });

  return (
    <Modal
      open
      onClose={onClose}
      title={guardian ? 'Edit guardian' : 'Add guardian'}
      footer={
        <>
          {guardian && canDelete && (
            <Button variant="ghost" className="mr-auto text-red-600" loading={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="guardian-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="guardian-form" className="space-y-4" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <FormError message={save.error ? errorMessage(save.error) : remove.error ? errorMessage(remove.error) : null} />
        <Field label="Full name" required error={errors.fullName?.message}>
          <Input {...register('fullName')} />
        </Field>
        <Field label="Relationship" required error={errors.relationship?.message}>
          <Select {...register('relationship')}>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <label className="flex min-h-touch items-center gap-3">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300" {...register('isPrimary')} />
          <span className="text-sm">Primary contact</span>
        </label>
      </form>
    </Modal>
  );
}
