'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { z } from 'zod';
import { makeGuardianSchema } from '@/components/guardian-fields';
import { Button, Card, Field, FormError, Input, NoAccess, PageHeader, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { ageFromDob, toInputDate } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { RELATIONSHIPS } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { PatientDetail } from '@/lib/types';
import { enumLabel, MessageKey, useT } from '@/lib/i18n';

const today = toInputDate(new Date());

const makeSchema = (t: (key: MessageKey) => string) =>
  z.object({
    firstName: z.string().trim().min(1, t('patients.firstNameRequired')).max(80),
    lastName: z.string().trim().min(1, t('patients.lastNameRequired')).max(80),
    dateOfBirth: z
      .string()
      .min(1, t('patients.dobRequired'))
      .refine((v) => v <= today, t('patients.dobFuture')),
    gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']).optional(),
    patientCode: z.string().trim().max(30).optional(),
    medicalNotes: z.string().max(5000).optional(),
    diagnosis: z.string().trim().max(200).optional(),
    primaryTherapistId: z.string().optional(),
    guardians: z.array(makeGuardianSchema(t)).min(1),
  });
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export default function NewPatientPage() {
  const me = useMe();
  const router = useRouter();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const qc = useQueryClient();
  const clinicians = useClinicians();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: '',
      guardians: [{ fullName: '', relationship: 'Mother', phone: '', email: '', isPrimary: true }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'guardians' });
  const dob = useWatch({ control, name: 'dateOfBirth' });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      api<PatientDetail>('/patients', {
        method: 'POST',
        body: {
          ...values,
          gender: values.gender || undefined,
          primaryTherapistId: values.primaryTherapistId || undefined,
          guardians: values.guardians.map((g, i) => ({ ...g, email: g.email || undefined, isPrimary: i === 0 })),
        },
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/patients/${p.id}`);
    },
  });

  if (!can(me.role, 'patient.create')) return <NoAccess />;

  return (
    <>
      <PageHeader title={t('patients.newPatient')} subtitle={t('patients.requiredFieldsHint')} />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-6" noValidate>
        <FormError message={create.error ? errorMessage(create.error) : null} />
        <Card title={t('patients.patient')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('patients.lastNameFamily')} required error={errors.lastName?.message}>
              <Input {...register('lastName')} placeholder={t('patients.lastNamePlaceholder')} />
            </Field>
            <Field label={t('patients.firstName')} required error={errors.firstName?.message}>
              <Input {...register('firstName')} placeholder={t('patients.firstNamePlaceholder')} />
            </Field>
            <Field
              label={t('patients.dateOfBirth')}
              required
              error={errors.dateOfBirth?.message}
              hint={dob && dob <= today ? t('patients.ageHint', { age: ageFromDob(dob) }) : undefined}
            >
              <Input type="date" max={today} {...register('dateOfBirth')} />
            </Field>
            <Field label={t('patients.gender')}>
              <Select {...register('gender')}>
                <option value="">{t('patients.genderNotSpecified')}</option>
                <option value="MALE">{enumLabel('MALE')}</option>
                <option value="FEMALE">{enumLabel('FEMALE')}</option>
                <option value="OTHER">{enumLabel('OTHER')}</option>
              </Select>
            </Field>
            <Field label={t('patients.patientCode')} hint={t('patients.patientCodeHint')} error={errors.patientCode?.message}>
              <Input {...register('patientCode')} />
            </Field>
            <Field label={t('patients.primaryTherapist')}>
              <Select {...register('primaryTherapistId')}>
                <option value="">{t('patients.unassigned')}</option>
                {clinicians.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('patients.diagnosisReferral')} className="sm:col-span-2">
              <Input {...register('diagnosis')} placeholder={t('patients.diagnosisPlaceholder')} />
            </Field>
            <Field label={t('patients.medicalNotes')} className="sm:col-span-2">
              <Textarea rows={3} {...register('medicalNotes')} />
            </Field>
          </div>
        </Card>

        <Card
          title={t('patients.guardian')}
          actions={
            fields.length < 3 && (
              <Button variant="secondary" size="sm" onClick={() => append({ fullName: '', relationship: 'Father', phone: '', email: '' })}>
                {t('patients.addAnotherGuardian')}
              </Button>
            )
          }
        >
          <div className="space-y-6">
            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-4 sm:grid-cols-2">
                {i > 0 && (
                  <div className="flex items-center justify-between sm:col-span-2">
                    <span className="text-sm font-medium text-slate-500">{t('patients.guardianN', { n: i + 1 })}</span>
                    <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                      {t('common.remove')}
                    </Button>
                  </div>
                )}
                <Field label={t('patients.fullName')} required error={errors.guardians?.[i]?.fullName?.message}>
                  <Input {...register(`guardians.${i}.fullName`)} />
                </Field>
                <Field label={t('patients.relationship')} required error={errors.guardians?.[i]?.relationship?.message}>
                  <Select {...register(`guardians.${i}.relationship`)}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {enumLabel(r)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('patients.phone')} required error={errors.guardians?.[i]?.phone?.message}>
                  <Input type="tel" inputMode="tel" {...register(`guardians.${i}.phone`)} placeholder="0903 123 456" />
                </Field>
                <Field label={t('patients.email')} error={errors.guardians?.[i]?.email?.message}>
                  <Input type="email" {...register(`guardians.${i}.email`)} />
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="lg" loading={create.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </>
  );
}
