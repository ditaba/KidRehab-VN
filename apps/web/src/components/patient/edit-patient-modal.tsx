'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, FormError, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { toInputDate } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { can } from '@/lib/permissions';
import type { PatientDetail } from '@/lib/types';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(80),
  lastName: z.string().trim().min(1, 'Required').max(80),
  dateOfBirth: z.string().min(1, 'Required'),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']),
  patientCode: z.string().trim().min(1, 'Required').max(30),
  primaryTherapistId: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCHARGED']),
  medicalNotes: z.string().max(5000),
});
type FormValues = z.infer<typeof schema>;

export function EditPatientModal({ patient, open, onClose }: { patient: PatientDetail; open: boolean; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const clinicians = useClinicians();
  const clinical = can(me.role, 'patient.editClinical');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth.slice(0, 10),
      gender: patient.gender ?? '',
      patientCode: patient.patientCode,
      primaryTherapistId: patient.primaryTherapist?.id ?? '',
      status: patient.status,
      medicalNotes: patient.medicalNotes ?? '',
    },
  });

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      api(`/patients/${patient.id}`, {
        method: 'PATCH',
        body: {
          firstName: v.firstName,
          lastName: v.lastName,
          dateOfBirth: v.dateOfBirth,
          gender: v.gender || undefined,
          patientCode: v.patientCode,
          primaryTherapistId: v.primaryTherapistId || null,
          ...(clinical ? { status: v.status, medicalNotes: v.medicalNotes } : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patient.id] });
      qc.invalidateQueries({ queryKey: ['patients'] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit patient"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-patient" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-patient" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label="Last name" required error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
        <Field label="First name" required error={errors.firstName?.message}>
          <Input {...register('firstName')} />
        </Field>
        <Field label="Date of birth" required error={errors.dateOfBirth?.message}>
          <Input type="date" max={toInputDate(new Date())} {...register('dateOfBirth')} />
        </Field>
        <Field label="Gender">
          <Select {...register('gender')}>
            <option value="">Not specified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Patient code" required error={errors.patientCode?.message}>
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
        {clinical && (
          <>
            <Field label="Status">
              <Select {...register('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCHARGED">Discharged</option>
              </Select>
            </Field>
            <Field label="Medical notes" className="sm:col-span-2">
              <Textarea rows={3} {...register('medicalNotes')} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
