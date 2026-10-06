'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { guardianSchema } from '@/components/guardian-fields';
import { Button, Card, Field, FormError, Input, NoAccess, PageHeader, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { ageFromDob, toInputDate } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { RELATIONSHIPS } from '@/lib/labels';
import { can } from '@/lib/permissions';
import type { PatientDetail } from '@/lib/types';

const today = toInputDate(new Date());

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => v <= today, 'Date of birth cannot be in the future'),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']).optional(),
  patientCode: z.string().trim().max(30).optional(),
  medicalNotes: z.string().max(5000).optional(),
  diagnosis: z.string().trim().max(200).optional(),
  primaryTherapistId: z.string().optional(),
  guardians: z.array(guardianSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

export default function NewPatientPage() {
  const me = useMe();
  const router = useRouter();
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
      <PageHeader title="New patient" subtitle="Fields marked * are required." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-6" noValidate>
        <FormError message={create.error ? errorMessage(create.error) : null} />
        <Card title="Patient">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Last name (family name)" required error={errors.lastName?.message}>
              <Input {...register('lastName')} placeholder="Nguyen" />
            </Field>
            <Field label="First name" required error={errors.firstName?.message}>
              <Input {...register('firstName')} placeholder="Van A" />
            </Field>
            <Field
              label="Date of birth"
              required
              error={errors.dateOfBirth?.message}
              hint={dob && dob <= today ? `Age: ${ageFromDob(dob)} years` : undefined}
            >
              <Input type="date" max={today} {...register('dateOfBirth')} />
            </Field>
            <Field label="Gender">
              <Select {...register('gender')}>
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Patient code" hint="Leave blank to generate automatically (KR-0001…)" error={errors.patientCode?.message}>
              <Input {...register('patientCode')} />
            </Field>
            <Field label="Primary therapist">
              <Select {...register('primaryTherapistId')}>
                <option value="">Unassigned</option>
                {clinicians.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Diagnosis / referral reason" className="sm:col-span-2">
              <Input {...register('diagnosis')} placeholder="e.g. Cerebral Palsy" />
            </Field>
            <Field label="Medical notes" className="sm:col-span-2">
              <Textarea rows={3} {...register('medicalNotes')} />
            </Field>
          </div>
        </Card>

        <Card
          title="Guardian"
          actions={
            fields.length < 3 && (
              <Button variant="secondary" size="sm" onClick={() => append({ fullName: '', relationship: 'Father', phone: '', email: '' })}>
                Add another guardian
              </Button>
            )
          }
        >
          <div className="space-y-6">
            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-4 sm:grid-cols-2">
                {i > 0 && (
                  <div className="flex items-center justify-between sm:col-span-2">
                    <span className="text-sm font-medium text-slate-500">Guardian {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                      Remove
                    </Button>
                  </div>
                )}
                <Field label="Full name" required error={errors.guardians?.[i]?.fullName?.message}>
                  <Input {...register(`guardians.${i}.fullName`)} />
                </Field>
                <Field label="Relationship" required error={errors.guardians?.[i]?.relationship?.message}>
                  <Select {...register(`guardians.${i}.relationship`)}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Phone" required error={errors.guardians?.[i]?.phone?.message}>
                  <Input type="tel" inputMode="tel" {...register(`guardians.${i}.phone`)} placeholder="0903 123 456" />
                </Field>
                <Field label="Email" error={errors.guardians?.[i]?.email?.message}>
                  <Input type="email" {...register(`guardians.${i}.email`)} />
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={create.isPending}>
            Save
          </Button>
        </div>
      </form>
    </>
  );
}
