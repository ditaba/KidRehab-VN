import { enumLabel } from './i18n';
import type {
  AppointmentStatus,
  AssistanceLevel,
  ExerciseCategory,
  GoalStatus,
  Mood,
  PatientStatus,
  PlanStatus,
  SessionStatus,
  Tolerance,
} from './types';

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet';

export const patientStatusTone: Record<PatientStatus, Tone> = { ACTIVE: 'green', INACTIVE: 'slate', DISCHARGED: 'violet' };
export const goalStatusTone: Record<GoalStatus, Tone> = {
  NOT_STARTED: 'slate',
  IN_PROGRESS: 'blue',
  ACHIEVED: 'green',
  PAUSED: 'amber',
  CANCELLED: 'red',
};
export const planStatusTone: Record<PlanStatus, Tone> = { DRAFT: 'slate', ACTIVE: 'green', COMPLETED: 'blue', CANCELLED: 'red' };
export const sessionStatusTone: Record<SessionStatus, Tone> = { DRAFT: 'amber', COMPLETED: 'green', CANCELLED: 'red' };
export const appointmentStatusTone: Record<AppointmentStatus, Tone> = {
  SCHEDULED: 'blue',
  CONFIRMED: 'violet',
  COMPLETED: 'green',
  CANCELLED: 'slate',
  NO_SHOW: 'red',
};

/** Option whose label follows the active language (read at render time). */
function option<T extends string>(value: T): { value: T; readonly label: string };
function option<T extends string>(value: T, icon: string): { value: T; readonly label: string; icon: string };
function option<T extends string>(value: T, icon?: string) {
  return {
    value,
    ...(icon !== undefined && { icon }),
    get label() {
      return enumLabel(value);
    },
  };
}

export const MOODS: { value: Mood; label: string; icon: string }[] = [
  option('HAPPY', '😄'),
  option('CALM', '🙂'),
  option('NEUTRAL', '😐'),
  option('IRRITABLE', '😣'),
  option('UPSET', '😢'),
];

export const TOLERANCES: { value: Tolerance; label: string }[] = [
  option('GOOD'),
  option('FAIR'),
  option('POOR'),
];

export const ASSISTANCE: { value: AssistanceLevel; label: string }[] = [
  option('INDEPENDENT'),
  option('SUPERVISION'),
  option('MINIMAL'),
  option('MODERATE'),
  option('MAXIMAL'),
  option('DEPENDENT'),
];

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'BALANCE',
  'STRENGTH',
  'WALKING',
  'STRETCHING',
  'COORDINATION',
  'MOBILITY',
  'OTHER',
];

export const RELATIONSHIPS = ['Mother', 'Father', 'Grandparent', 'Guardian', 'Other'] as const;

export const GOAL_STATUSES: GoalStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PAUSED', 'CANCELLED'];
export const PLAN_STATUSES: PlanStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
