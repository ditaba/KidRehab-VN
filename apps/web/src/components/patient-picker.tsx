'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Input } from '@/components/ui';
import { api } from '@/lib/api';
import { patientName } from '@/lib/format';
import type { Paginated, PatientListItem, PatientRef } from '@/lib/types';
import { useDebounce } from '@/lib/use-debounce';
import { useT } from '@/lib/i18n';

/** Type-ahead patient search (name or code). */
export function PatientPicker({ value, onChange }: { value: PatientRef | null; onChange: (p: PatientRef | null) => void }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 250);
  const { data, isFetching } = useQuery({
    queryKey: ['patients', 'picker', q],
    queryFn: () => api<Paginated<PatientListItem>>('/patients', { query: { search: q, status: 'ACTIVE', pageSize: 8 } }),
    enabled: !value,
  });

  if (value) {
    return (
      <div className="flex min-h-touch items-center justify-between rounded-xl border border-slate-300 px-3">
        <span>
          <span className="font-medium">{patientName(value)}</span> <span className="text-sm text-slate-500">{value.patientCode}</span>
        </span>
        <button type="button" className="min-h-touch px-2 text-sm text-primary-700" onClick={() => onChange(null)}>
          {t('patients.change')}
        </button>
      </div>
    );
  }
  return (
    <div>
      <Input type="search" placeholder={t('patients.pickerPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
        {isFetching && !data && <li className="px-3 py-2 text-sm text-slate-500">{t('patients.searching')}</li>}
        {data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('patients.noActivePatients')}</li>}
        {data?.data.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onChange(p)} className="flex min-h-touch w-full items-center justify-between px-3 text-left hover:bg-primary-50">
              <span>{patientName(p)}</span>
              <span className="text-sm text-slate-500">
                {p.patientCode} · {t('patients.ageShort', { age: p.age })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
