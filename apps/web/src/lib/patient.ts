'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from './api';
import type { PatientDetail } from './types';

export function usePatientId() {
  const params = useParams<{ id: string }>();
  return params.id;
}

export function usePatient(id: string) {
  return useQuery({ queryKey: ['patient', id], queryFn: () => api<PatientDetail>(`/patients/${id}`) });
}
