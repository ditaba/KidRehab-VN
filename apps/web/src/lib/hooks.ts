'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from './api';
import type { Role, SessionDetail } from './types';

export interface StaffMember {
  id: string;
  fullName: string;
  role: Role;
  email: string;
  isActive: boolean;
}

export function useStaff(role?: Role) {
  return useQuery({
    queryKey: ['users', role ?? 'all'],
    queryFn: () => api<StaffMember[]>('/users', { query: { role } }),
    staleTime: 5 * 60_000,
  });
}

/** Clinicians who can be booked / assigned (therapists and doctors). */
export function useClinicians() {
  const q = useStaff();
  return { ...q, data: q.data?.filter((u) => (u.role === 'THERAPIST' || u.role === 'DOCTOR') && u.isActive) };
}

/** "Start Session": creates (or re-opens) the session for an appointment and navigates to it. */
export function useStartSession() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) =>
      api<SessionDetail>(`/patients/${patientId}/sessions`, { method: 'POST', body: { appointmentId } }),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/sessions/${session.id}`);
    },
  });
}
