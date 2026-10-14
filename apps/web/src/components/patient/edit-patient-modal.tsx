'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, FormError, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { toInputDate } from '@/lib/format';
import { useClinicians } from '@/lib/hooks';
import { can } from '@/lib/permissions';
import type { PatientDetail } from '@/lib/types';
import { enumLabel, MessageKey, useT } from '@/lib/i18n';

const makeSchema = (t: (key: MessageKey) => string) =>
  z.object({
    firstName: z.string().trim().min(1, t('common.required')).max(80),
    lastName: z.string().trim().min(1, t('common.required')).max(80),
    dateOfBirth: z.string().min(1, t('common.required')),
    gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER']),
    patientCode: z.string().trim().min(1, t('common.required')).max(30),
    primaryTherapistId: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCHARGED']),
    medicalNotes: z.string().max(5000),
  });
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export function EditPatientModal({ patient, open, onClose }: { patient: PatientDetail; open: boolean; onClose: () => void }) {
  const me = useMe();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
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
      title={t('patients.editPatient')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="edit-patient" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="edit-patient" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={save.error ? errorMessage(save.error) : null} />
        </div>
        <Field label={t('patients.lastName')} required error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
        <Field label={t('patients.firstName')} required error={errors.firstName?.message}>
          <Input {...register('firstName')} />
        </Field>
        <Field label={t('patients.dateOfBirth')} required error={errors.dateOfBirth?.message}>
          <Input type="date" max={toInputDate(new Date())} {...register('dateOfBirth')} />
        </Field>
        <Field label={t('patients.gender')}>
          <Select {...register('gender')}>
            <option value="">{t('patients.genderNotSpecified')}</option>
            <option value="MALE">{enumLabel('MALE')}</option>
            <option value="FEMALE">{enumLabel('FEMALE')}</option>
            <option value="OTHER">{enumLabel('OTHER')}</option>
          </Select>
        </Field>
        <Field label={t('patients.patientCode')} required error={errors.patientCode?.message}>
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
        {clinical && (
          <>
            <Field label={t('common.status')}>
              <Select {...register('status')}>
                <option value="ACTIVE">{enumLabel('ACTIVE')}</option>
                <option value="INACTIVE">{enumLabel('INACTIVE')}</option>
                <option value="DISCHARGED">{enumLabel('DISCHARGED')}</option>
              </Select>
            </Field>
            <Field label={t('patients.medicalNotes')} className="sm:col-span-2">
              <Textarea rows={3} {...register('medicalNotes')} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
