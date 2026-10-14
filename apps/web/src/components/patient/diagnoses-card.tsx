'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Field, FormError, Input, Modal } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { can } from '@/lib/permissions';
import type { Diagnosis } from '@/lib/types';
import { useT } from '@/lib/i18n';

export function DiagnosesCard({ patientId, diagnoses }: { patientId: string; diagnoses: Diagnosis[] }) {
  const me = useMe();
  const t = useT();
  const editable = can(me.role, 'diagnosis.edit');
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [icdCode, setIcd] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['patient', patientId] });
    qc.invalidateQueries({ queryKey: ['patients'] });
  };
  const add = useMutation({
    mutationFn: () => api(`/patients/${patientId}/diagnoses`, { method: 'POST', body: { name, icdCode, isPrimary: diagnoses.length === 0 } }),
    onSuccess: () => {
      refresh();
      setAdding(false);
      setName('');
      setIcd('');
    },
  });
  const makePrimary = useMutation({
    mutationFn: (id: string) => api(`/diagnoses/${id}`, { method: 'PATCH', body: { isPrimary: true } }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/diagnoses/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <Card
      title={t('patients.diagnosis')}
      actions={
        editable && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            {t('patients.addShort')}
          </Button>
        )
      }
    >
      {diagnoses.length === 0 ? (
        <p className="text-sm text-slate-500">{t('patients.noDiagnosis')}</p>
      ) : (
        <ul className="space-y-3">
          {diagnoses.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {d.name} {d.isPrimary && <Badge tone="blue">{t('patients.primary')}</Badge>}
                </p>
                {d.icdCode && <p className="text-sm text-slate-500">{t('patients.icdLine', { code: d.icdCode })}</p>}
              </div>
              {editable && (
                <div className="flex shrink-0 gap-1">
                  {!d.isPrimary && (
                    <Button variant="ghost" size="sm" onClick={() => makePrimary.mutate(d.id)}>
                      {t('patients.makePrimary')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => confirm(t('patients.confirmRemoveDiagnosis', { name: d.name })) && remove.mutate(d.id)}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('patients.addDiagnosis')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!name.trim()} loading={add.isPending} onClick={() => add.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={add.error ? errorMessage(add.error) : null} />
          <Field label={t('patients.diagnosis')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('patients.diagnosisInputPlaceholder')} />
          </Field>
          <Field label={t('patients.icdCode')}>
            <Input value={icdCode} onChange={(e) => setIcd(e.target.value)} placeholder="G80.1" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
