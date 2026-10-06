export type Role = 'ADMIN' | 'DOCTOR' | 'THERAPIST' | 'RECEPTIONIST';
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DISCHARGED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'PAUSED' | 'CANCELLED';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SessionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type Direction = 'INCREASE_IS_BETTER' | 'DECREASE_IS_BETTER';
export type Mood = 'HAPPY' | 'CALM' | 'NEUTRAL' | 'IRRITABLE' | 'UPSET';
export type Tolerance = 'GOOD' | 'FAIR' | 'POOR';
export type AssistanceLevel = 'INDEPENDENT' | 'SUPERVISION' | 'MINIMAL' | 'MODERATE' | 'MAXIMAL' | 'DEPENDENT';
export type ExerciseCategory = 'BALANCE' | 'STRENGTH' | 'WALKING' | 'STRETCHING' | 'COORDINATION' | 'MOBILITY' | 'OTHER';

export interface UserRef {
  id: string;
  fullName: string;
  role: Role;
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  clinicId: string;
  clinic?: { id: string; name: string; timezone: string; defaultAppointmentMinutes: number };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PatientRef {
  id: string;
  firstName: string;
  lastName: string;
  patientCode: string;
}

export interface PatientListItem extends PatientRef {
  dateOfBirth: string;
  age: number;
  gender: Gender | null;
  status: PatientStatus;
  diagnosis: string | null;
  therapist: UserRef | null;
  lastSession: { id: string; sessionDate: string } | null;
  nextAppointment: { id: string; startAt: string } | null;
}

export interface Guardian {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

export interface Diagnosis {
  id: string;
  name: string;
  icdCode: string | null;
  isPrimary: boolean;
  notes: string | null;
  diagnosedAt: string | null;
}

export interface Progress {
  raw: number;
  percent: number;
}

export interface Goal {
  id: string;
  treatmentPlanId: string;
  title: string;
  description: string | null;
  metricName: string;
  unit: string;
  direction: Direction;
  baselineValue: number;
  targetValue: number;
  currentValue: number | null;
  targetDate: string | null;
  status: GoalStatus;
  progress: Progress;
  metric?: { id: string; name?: string; unit?: string } | null;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  title: string;
  primaryObjective: string | null;
  startDate: string;
  reviewDate: string | null;
  recommendedFrequency: string | null;
  expectedDuration: string | null;
  notes: string | null;
  status: PlanStatus;
  goals: Goal[];
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  sessionDate: string;
  status: SessionStatus;
  therapist: UserRef;
  durationMinutes: number | null;
  tolerance: Tolerance | null;
  notes: string | null;
  _count?: { exercises: number; measurements: number };
}

export interface PatientDetail {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender: Gender | null;
  status: PatientStatus;
  medicalNotes?: string | null;
  primaryTherapist: UserRef | null;
  guardians: Guardian[];
  diagnoses: Diagnosis[];
  nextAppointment: (Appointment & { therapist: UserRef }) | null;
  activePlan: TreatmentPlan | null;
  recentSessions: SessionSummary[];
  latestAssessment: { id: string; type: string; assessedAt: string; author: UserRef } | null;
  needsReassessment?: boolean;
  clinicalAccess: boolean;
}

export interface Assessment {
  id: string;
  patientId: string;
  type: 'INITIAL' | 'REASSESSMENT';
  assessedAt: string;
  medicalHistory: string | null;
  developmentHistory: string | null;
  functionalAbility: string | null;
  rangeOfMotion: string | null;
  strength: string | null;
  balance: string | null;
  gait: string | null;
  painScore: number | null;
  pain: string | null;
  clinicalNotes: string | null;
  author: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string | null;
  instructions: string | null;
  defaultSets: number | null;
  defaultRepetitions: number | null;
  defaultDurationSeconds: number | null;
  status: 'ACTIVE' | 'DISABLED';
  _count?: { sessionExercises: number };
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  notes: string | null;
  sortOrder: number;
}

export interface Measurement {
  id: string;
  progressMetricId: string;
  therapySessionId: string | null;
  value: number;
  measuredAt: string;
  notes: string | null;
  metric: { id: string; name: string; unit: string; treatmentGoalId: string | null };
}

export interface SessionDetail {
  id: string;
  patientId: string;
  therapistId: string;
  appointmentId: string | null;
  sessionDate: string;
  durationMinutes: number | null;
  painScore: number | null;
  energyLevel: number | null;
  mood: Mood | null;
  tolerance: Tolerance | null;
  assistanceLevel: AssistanceLevel | null;
  notes: string | null;
  status: SessionStatus;
  completedAt: string | null;
  therapist: UserRef;
  appointment: { id: string; startAt: string; durationMinutes: number; status: AppointmentStatus } | null;
  exercises: SessionExercise[];
  measurements: Measurement[];
  patient: PatientRef & { age: number; dateOfBirth: string; diagnoses: { id: string; name: string; isPrimary: boolean }[] };
  goals: (Goal & { metric: { id: string; name: string; unit: string } | null })[];
  activePlan: { id: string; title: string } | null;
  previousSession:
    | (SessionSummary & {
        assistanceLevel: AssistanceLevel | null;
        painScore: number | null;
        exercises: { exerciseName: string; sets: number | null; repetitions: number | null; durationSeconds: number | null }[];
        measurements: Measurement[];
      })
    | null;
}

export interface SessionListItem extends SessionSummary {
  patient: PatientRef;
  measurements: Measurement[];
}

export interface Appointment {
  id: string;
  patientId: string;
  therapistId: string;
  startAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  patient: PatientRef;
  therapist: UserRef;
  session: { id: string; status: SessionStatus } | null;
}

export interface TodaySessions {
  date: string;
  timezone: string;
  appointments: (Omit<Appointment, 'patient'> & {
    patient: PatientRef & { age: number; diagnosis: string | null };
  })[];
  walkIns: (SessionSummary & { patient: PatientRef })[];
}

export interface DashboardData {
  stats: {
    activePatients: number;
    todaySessions: number;
    todaySessionsCompleted: number;
    needReassessment: number;
    missedAppointments: number;
  };
  todayAppointments: Appointment[];
  needReassessmentPatients: (PatientRef & { age: number; lastAssessedAt: string | null })[];
}

export interface ProgressGoal extends Goal {
  plan: { id: string; title: string; status: PlanStatus };
  measurements: {
    id: string;
    value: number;
    measuredAt: string;
    sessionId: string | null;
    sessionDate: string | null;
    therapist: string;
    notes: string | null;
  }[];
}
