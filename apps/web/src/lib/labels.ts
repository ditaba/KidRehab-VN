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

export const MOODS: { value: Mood; label: string; icon: string }[] = [
  { value: 'HAPPY', label: 'Happy', icon: '😄' },
  { value: 'CALM', label: 'Calm', icon: '🙂' },
  { value: 'NEUTRAL', label: 'Neutral', icon: '😐' },
  { value: 'IRRITABLE', label: 'Irritable', icon: '😣' },
  { value: 'UPSET', label: 'Upset', icon: '😢' },
];

export const TOLERANCES: { value: Tolerance; label: string }[] = [
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

export const ASSISTANCE: { value: AssistanceLevel; label: string }[] = [
  { value: 'INDEPENDENT', label: 'Independent' },
  { value: 'SUPERVISION', label: 'Supervision' },
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAXIMAL', label: 'Maximal' },
  { value: 'DEPENDENT', label: 'Dependent' },
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
