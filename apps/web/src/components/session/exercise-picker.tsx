'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ErrorState, Input, Loading, Modal } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatPrescription, humanize } from '@/lib/format';
import { EXERCISE_CATEGORIES } from '@/lib/labels';
import type { Exercise, ExerciseCategory } from '@/lib/types';

/** US-052: pick an exercise template from the library (only ACTIVE ones). */
export function ExercisePicker({ open, onClose, onPick, addedIds }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void; addedIds: string[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exercises', 'ACTIVE'],
    queryFn: () => api<Exercise[]>('/exercises', { query: { status: 'ACTIVE' } }),
    enabled: open,
  });
  const filtered = (data ?? []).filter(
    (e) => (!category || e.category === category) && (!search || e.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <Modal open={open} onClose={onClose} title="Add exercise" size="lg">
      <div className="space-y-4">
        <Input type="search" placeholder="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="flex flex-wrap gap-2">
          {[null, ...EXERCISE_CATEGORIES].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              onClick={() => setCategory(c)}
              className={clsx(
                'min-h-[40px] rounded-full border px-4 text-sm font-medium',
                category === c ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white text-slate-600',
              )}
            >
              {c ? humanize(c) : 'All'}
            </button>
          ))}
        </div>
        {isLoading && <Loading />}
        {error && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
        {data && filtered.length === 0 && <EmptyState title="No exercises match" />}
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((e) => {
            const added = addedIds.includes(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex min-h-[64px] w-full flex-col items-start rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="font-medium text-slate-900">
                    {e.name} {added && <span className="text-xs font-normal text-success-700">· added</span>}
                  </span>
                  <span className="text-sm text-slate-500">
                    {humanize(e.category)} · {formatPrescription({ sets: e.defaultSets, repetitions: e.defaultRepetitions, durationSeconds: e.defaultDurationSeconds })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
