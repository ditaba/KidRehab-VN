import type { Role } from './types';

/** Mirrors the API's RBAC so the UI only offers actions the user may perform. */
const matrix = {
  'patient.create': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  'patient.edit': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  'patient.editClinical': ['ADMIN', 'DOCTOR'],
  'guardian.edit': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  'diagnosis.edit': ['ADMIN', 'DOCTOR'],
  'clinical.view': ['ADMIN', 'DOCTOR', 'THERAPIST'],
  'assessment.edit': ['DOCTOR'],
  'treatment.edit': ['DOCTOR'],
  'session.write': ['DOCTOR', 'THERAPIST'],
  'appointment.edit': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  'exercise.edit': ['ADMIN', 'DOCTOR'],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof matrix;

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && (matrix[permission] as Role[]).includes(role);
}
