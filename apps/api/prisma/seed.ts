/**
 * Demo seed: 1 clinic, admin, doctor, 2 therapists, receptionist, 10 patients,
 * exercise templates, sessions and progress measurements.
 *
 * Demo patient "Nguyen Van A" (5 y, cerebral palsy) has the rich history used in product demos:
 *   Standing Duration 5 → 22 sec (target 30), Walking Distance 2 → 8 m (target 10).
 *
 * WARNING: wipes all existing data in the target database.
 */
import {
  AppointmentStatus,
  AssessmentType,
  AssistanceLevel,
  ExerciseCategory,
  Gender,
  GoalStatus,
  MetricDirection,
  Mood,
  PatientStatus,
  PrismaClient,
  Role,
  SessionStatus,
  Tolerance,
  TreatmentPlanStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { tzOffsetMinutes } from '../src/common/time';

try {
  process.loadEnvFile();
} catch {
  /* env provided by the shell */
}

const prisma = new PrismaClient();
const TZ = 'Asia/Ho_Chi_Minh';
export const DEMO_PASSWORD = 'Password123!';

/** Clinic-local date `dayOffset` days from today at hh:mm, as a UTC Date. */
function at(dayOffset: number, hh = 9, mm = 0): Date {
  const now = new Date();
  const offset = tzOffsetMinutes(now, TZ);
  const local = new Date(now.getTime() + offset * 60000);
  const utc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, hh, mm);
  return new Date(utc - offset * 60000);
}

function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function yearsAgo(years: number, extraDays = 0) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear() - years, d.getUTCMonth(), d.getUTCDate() - extraDays));
}

async function wipe() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.progressMeasurement.deleteMany(),
    prisma.sessionExercise.deleteMany(),
    prisma.therapySession.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.progressMetric.deleteMany(),
    prisma.treatmentGoal.deleteMany(),
    prisma.treatmentPlan.deleteMany(),
    prisma.assessment.deleteMany(),
    prisma.diagnosis.deleteMany(),
    prisma.guardian.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.exercise.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.clinic.deleteMany(),
  ]);
}

interface GoalSpec {
  title: string;
  metricName: string;
  unit: string;
  baseline: number;
  target: number;
  direction?: MetricDirection;
  targetInDays: number;
  /** One value per completed session (in order). */
  values: number[];
}

interface PatientSpec {
  code: string;
  lastName: string;
  firstName: string;
  dob: Date;
  gender: Gender;
  status?: PatientStatus;
  diagnosis: string;
  icd?: string;
  therapist: 'T1' | 'T2';
  guardian: { fullName: string; relationship: string; phone: string; email?: string };
  medicalNotes?: string;
  /** Days ago of the initial assessment (null = never assessed). */
  assessedDaysAgo: number | null;
  plan?: { title: string; objective: string; frequency: string; duration: string; startDaysAgo: number; reviewInDays: number };
  goals?: GoalSpec[];
  /** Day offsets (negative = past) of completed sessions. */
  sessionDays?: number[];
  exercises?: string[];
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const clinic = await prisma.clinic.create({
    data: {
      name: 'KidRehab Saigon Pediatric Rehabilitation Center',
      address: '123 Nguyen Thi Minh Khai, District 3, Ho Chi Minh City',
      phone: '028 3930 0000',
      timezone: TZ,
      defaultAppointmentMinutes: 45,
      reassessmentIntervalDays: 90,
    },
  });

  const mkUser = (email: string, fullName: string, role: Role) =>
    prisma.user.create({ data: { clinicId: clinic.id, email, fullName, role, passwordHash } });

  const admin = await mkUser('admin@kidrehab.vn', 'Admin Vo Thanh Tam', Role.ADMIN);
  const doctor = await mkUser('doctor@kidrehab.vn', 'Dr. Nguyen Thanh Hai', Role.DOCTOR);
  const t1 = await mkUser('therapist1@kidrehab.vn', 'Tran Minh Chau', Role.THERAPIST);
  const t2 = await mkUser('therapist2@kidrehab.vn', 'Le Thu Ha', Role.THERAPIST);
  await mkUser('reception@kidrehab.vn', 'Pham Thi Lan', Role.RECEPTIONIST);
  const therapists = { T1: t1, T2: t2 };

  // ---- Exercise library ----------------------------------------------------
  const exerciseSpecs: Array<{
    name: string;
    category: ExerciseCategory;
    description: string;
    instructions: string;
    sets?: number;
    reps?: number;
    duration?: number;
  }> = [
    {
      name: 'Standing Balance',
      category: ExerciseCategory.BALANCE,
      description: 'Static standing with decreasing support to build postural control.',
      instructions: 'Child stands on a firm surface, feet hip-width apart. Reduce hand support progressively. Stay within arm’s reach.',
      sets: 3,
      duration: 30,
    },
    {
      name: 'Sit-to-Stand',
      category: ExerciseCategory.STRENGTH,
      description: 'Functional lower-limb strengthening from a bench.',
      instructions: 'Use a bench at knee height. Feet flat, lean forward, push up to stand, sit down slowly.',
      sets: 3,
      reps: 10,
    },
    {
      name: 'Assisted Walking',
      category: ExerciseCategory.WALKING,
      description: 'Gait training with walker or hand-held assistance.',
      instructions: 'Walk along a 10 m track. Record distance and assistance level. Cue heel strike.',
      sets: 2,
      duration: 120,
    },
    {
      name: 'Hamstring Stretch',
      category: ExerciseCategory.STRETCHING,
      description: 'Passive/active-assisted hamstring stretch in long sitting.',
      instructions: 'Hold each stretch gently for 30 seconds. Never force through pain.',
      sets: 3,
      duration: 30,
    },
    {
      name: 'Ball Catch & Throw',
      category: ExerciseCategory.COORDINATION,
      description: 'Bilateral coordination and visual-motor integration.',
      instructions: 'Use a soft 20 cm ball at 1–2 m distance. Progress to smaller ball or greater distance.',
      sets: 2,
      reps: 10,
    },
    {
      name: 'Heel Raises',
      category: ExerciseCategory.STRENGTH,
      description: 'Calf strengthening with support.',
      instructions: 'Hold on to a rail, rise onto toes, hold 2 seconds, lower slowly.',
      sets: 3,
      reps: 12,
    },
    {
      name: 'Tunnel Crawling',
      category: ExerciseCategory.MOBILITY,
      description: 'Reciprocal crawling through a play tunnel.',
      instructions: 'Encourage four-point crawling through a 2 m tunnel. Use toys as motivation.',
      sets: 3,
      reps: 3,
    },
    {
      name: 'Tummy Time Reach',
      category: ExerciseCategory.OTHER,
      description: 'Prone weight-bearing with reaching (archived template).',
      instructions: 'Superseded by Tunnel Crawling for this clinic.',
      sets: 3,
      duration: 60,
    },
  ];
  const exercises: Record<string, { id: string; name: string; defaultSets: number | null; defaultRepetitions: number | null; defaultDurationSeconds: number | null }> = {};
  for (const e of exerciseSpecs) {
    exercises[e.name] = await prisma.exercise.create({
      data: {
        clinicId: clinic.id,
        name: e.name,
        category: e.category,
        description: e.description,
        instructions: e.instructions,
        defaultSets: e.sets,
        defaultRepetitions: e.reps,
        defaultDurationSeconds: e.duration,
        status: e.name === 'Tummy Time Reach' ? 'DISABLED' : 'ACTIVE',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
  }

  // ---- Patients --------------------------------------------------------------
  const specs: PatientSpec[] = [
    {
      code: 'KR-0001',
      lastName: 'Nguyen',
      firstName: 'Van A',
      dob: yearsAgo(5, 40),
      gender: Gender.MALE,
      diagnosis: 'Cerebral Palsy – spastic diplegia (GMFCS II)',
      icd: 'G80.1',
      therapist: 'T1',
      guardian: { fullName: 'Nguyen Thi Mai', relationship: 'Mother', phone: '0903 123 456', email: 'mai.nguyen@example.com' },
      medicalNotes: 'Born at 32 weeks. Wears bilateral AFOs. No seizures.',
      assessedDaysAgo: 64,
      plan: {
        title: 'Standing & walking independence',
        objective: 'Improve standing balance and independent walking distance for home and kindergarten mobility.',
        frequency: '3 sessions / week',
        duration: '6 months',
        startDaysAgo: 63,
        reviewInDays: 30,
      },
      goals: [
        {
          title: 'Stand independently',
          metricName: 'Standing Duration',
          unit: 'seconds',
          baseline: 5,
          target: 30,
          targetInDays: 37,
          values: [5, 9, 15, 19, 22],
        },
        {
          title: 'Walk independently at home',
          metricName: 'Walking Distance',
          unit: 'm',
          baseline: 2,
          target: 10,
          targetInDays: 60,
          values: [2, 3.5, 5, 6.5, 8],
        },
      ],
      sessionDays: [-62, -52, -35, -21, -1],
      exercises: ['Standing Balance', 'Assisted Walking', 'Sit-to-Stand'],
    },
    {
      code: 'KR-0002',
      lastName: 'Tran',
      firstName: 'Thi B',
      dob: yearsAgo(4, 100),
      gender: Gender.FEMALE,
      diagnosis: 'Global developmental delay',
      icd: 'F88',
      therapist: 'T1',
      guardian: { fullName: 'Tran Van Hung', relationship: 'Father', phone: '0912 222 333' },
      assessedDaysAgo: 40,
      plan: {
        title: 'Gross motor development',
        objective: 'Achieve age-appropriate sit-to-stand and squat-to-stand transitions.',
        frequency: '2 sessions / week',
        duration: '4 months',
        startDaysAgo: 38,
        reviewInDays: 45,
      },
      goals: [
        {
          title: 'Independent sit-to-stand',
          metricName: 'Sit-to-Stand Repetitions (30 s)',
          unit: 'reps',
          baseline: 2,
          target: 8,
          targetInDays: 80,
          values: [2, 3, 4, 5],
        },
      ],
      sessionDays: [-35, -24, -14, -4],
      exercises: ['Sit-to-Stand', 'Tunnel Crawling'],
    },
    {
      code: 'KR-0003',
      lastName: 'Le',
      firstName: 'Van C',
      dob: yearsAgo(7, 15),
      gender: Gender.MALE,
      diagnosis: 'Down syndrome with hypotonia',
      icd: 'Q90.9',
      therapist: 'T1',
      guardian: { fullName: 'Le Thi Thu', relationship: 'Mother', phone: '0987 654 321' },
      assessedDaysAgo: 120, // overdue for reassessment
      plan: {
        title: 'Balance and endurance',
        objective: 'Improve single-leg balance and walking endurance.',
        frequency: '2 sessions / week',
        duration: '6 months',
        startDaysAgo: 118,
        reviewInDays: -5,
      },
      goals: [
        {
          title: 'Single-leg stance',
          metricName: 'Single-Leg Stance',
          unit: 'seconds',
          baseline: 1,
          target: 10,
          targetInDays: 60,
          values: [1, 2, 3, 3, 4],
        },
      ],
      sessionDays: [-110, -80, -50, -30, -9],
      exercises: ['Standing Balance', 'Heel Raises'],
    },
    {
      code: 'KR-0004',
      lastName: 'Pham',
      firstName: 'Minh D',
      dob: yearsAgo(3, 20),
      gender: Gender.MALE,
      diagnosis: 'Congenital muscular torticollis',
      icd: 'Q68.0',
      therapist: 'T2',
      guardian: { fullName: 'Pham Thi Hoa', relationship: 'Mother', phone: '0905 111 222' },
      assessedDaysAgo: 30,
      plan: {
        title: 'Neck range of motion',
        objective: 'Restore full cervical rotation and reduce head tilt.',
        frequency: '2 sessions / week',
        duration: '3 months',
        startDaysAgo: 28,
        reviewInDays: 60,
      },
      goals: [
        {
          title: 'Reduce head tilt',
          metricName: 'Head Tilt Angle',
          unit: '°',
          baseline: 15,
          target: 3,
          direction: MetricDirection.DECREASE_IS_BETTER,
          targetInDays: 60,
          values: [15, 12, 10],
        },
      ],
      sessionDays: [-25, -14, -3],
      exercises: ['Hamstring Stretch'],
    },
    {
      code: 'KR-0005',
      lastName: 'Hoang',
      firstName: 'Thi E',
      dob: yearsAgo(6, 200),
      gender: Gender.FEMALE,
      diagnosis: 'Autism spectrum disorder – motor coordination difficulties',
      icd: 'F84.0',
      therapist: 'T2',
      guardian: { fullName: 'Hoang Van Nam', relationship: 'Father', phone: '0938 777 888' },
      assessedDaysAgo: 20,
      plan: {
        title: 'Coordination for play',
        objective: 'Improve ball skills to participate in group play.',
        frequency: '1 session / week',
        duration: '3 months',
        startDaysAgo: 18,
        reviewInDays: 70,
      },
      goals: [
        {
          title: 'Catch a ball from 2 m',
          metricName: 'Successful Catches (out of 10)',
          unit: 'catches',
          baseline: 2,
          target: 8,
          targetInDays: 70,
          values: [2, 4],
        },
      ],
      sessionDays: [-14, -7],
      exercises: ['Ball Catch & Throw'],
    },
    {
      code: 'KR-0006',
      lastName: 'Vu',
      firstName: 'Duc F',
      dob: yearsAgo(8, 50),
      gender: Gender.MALE,
      diagnosis: 'Post-operative rehabilitation – tibial fracture',
      icd: 'S82.2',
      therapist: 'T2',
      guardian: { fullName: 'Vu Thi Lien', relationship: 'Grandparent', phone: '0909 333 444' },
      assessedDaysAgo: 10,
      plan: {
        title: 'Return to full weight bearing',
        objective: 'Restore knee range of motion and normal gait.',
        frequency: '3 sessions / week',
        duration: '8 weeks',
        startDaysAgo: 9,
        reviewInDays: 20,
      },
      goals: [
        {
          title: 'Knee flexion range',
          metricName: 'Knee Flexion',
          unit: '°',
          baseline: 70,
          target: 130,
          targetInDays: 45,
          values: [70, 85],
        },
      ],
      sessionDays: [-8, -2],
      exercises: ['Heel Raises', 'Assisted Walking'],
    },
    {
      code: 'KR-0007',
      lastName: 'Dang',
      firstName: 'Ngoc G',
      dob: yearsAgo(2, 30),
      gender: Gender.FEMALE,
      diagnosis: "Brachial plexus birth palsy (Erb's palsy)",
      icd: 'P14.0',
      therapist: 'T1',
      guardian: { fullName: 'Dang Van Tuan', relationship: 'Father', phone: '0918 555 666' },
      assessedDaysAgo: null, // new patient, never assessed
    },
    {
      code: 'KR-0008',
      lastName: 'Bui',
      firstName: 'Quang H',
      dob: yearsAgo(9, 10),
      gender: Gender.MALE,
      diagnosis: 'Idiopathic toe walking',
      icd: 'R26.89',
      therapist: 'T2',
      guardian: { fullName: 'Bui Thi Ngoc', relationship: 'Mother', phone: '0977 121 212' },
      assessedDaysAgo: 50,
      plan: {
        title: 'Heel-toe gait',
        objective: 'Increase ankle dorsiflexion and heel strike during walking.',
        frequency: '2 sessions / week',
        duration: '3 months',
        startDaysAgo: 48,
        reviewInDays: 40,
      },
      goals: [
        {
          title: 'Ankle dorsiflexion',
          metricName: 'Ankle Dorsiflexion',
          unit: '°',
          baseline: -5,
          target: 10,
          targetInDays: 50,
          values: [-5, 0, 3],
        },
      ],
      sessionDays: [-45, -30, -16],
      exercises: ['Hamstring Stretch', 'Heel Raises'],
    },
    {
      code: 'KR-0009',
      lastName: 'Do',
      firstName: 'Thu I',
      dob: yearsAgo(5, 300),
      gender: Gender.FEMALE,
      status: PatientStatus.INACTIVE,
      diagnosis: 'Spina bifida (lumbar myelomeningocele)',
      icd: 'Q05.7',
      therapist: 'T1',
      guardian: { fullName: 'Do Van Long', relationship: 'Guardian', phone: '0966 999 000' },
      assessedDaysAgo: 200,
    },
    {
      code: 'KR-0010',
      lastName: 'Ngo',
      firstName: 'Gia K',
      dob: yearsAgo(10, 70),
      gender: Gender.MALE,
      status: PatientStatus.DISCHARGED,
      diagnosis: 'Juvenile idiopathic arthritis',
      icd: 'M08.0',
      therapist: 'T2',
      guardian: { fullName: 'Ngo Thi Bich', relationship: 'Mother', phone: '0944 343 434' },
      assessedDaysAgo: 300,
    },
  ];

  const patients: Record<string, { id: string; therapistId: string }> = {};
  for (const s of specs) {
    const therapist = therapists[s.therapist];
    const patient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        patientCode: s.code,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: dateOnly(s.dob),
        gender: s.gender,
        status: s.status ?? PatientStatus.ACTIVE,
        medicalNotes: s.medicalNotes,
        primaryTherapistId: therapist.id,
        createdBy: admin.id,
        updatedBy: admin.id,
        guardians: { create: { ...s.guardian, isPrimary: true } },
        diagnoses: {
          create: { name: s.diagnosis, icdCode: s.icd, isPrimary: true, createdBy: doctor.id, updatedBy: doctor.id },
        },
      },
    });
    patients[s.code] = { id: patient.id, therapistId: therapist.id };

    if (s.assessedDaysAgo !== null) {
      await prisma.assessment.create({
        data: {
          patientId: patient.id,
          authorId: doctor.id,
          updatedBy: doctor.id,
          type: AssessmentType.INITIAL,
          assessedAt: at(-s.assessedDaysAgo, 10),
          medicalHistory: s.medicalNotes ?? 'Unremarkable perinatal history.',
          developmentHistory:
            s.code === 'KR-0001'
              ? 'Sat independently at 14 months. Not yet walking independently. Cruises along furniture.'
              : 'Milestones mildly delayed per parent report.',
          functionalAbility:
            s.code === 'KR-0001'
              ? 'Stands with support; independent standing ~5 s. Walks ~2 m with posterior walker.'
              : 'See goals.',
          rangeOfMotion: s.code === 'KR-0001' ? 'Bilateral ankle dorsiflexion limited to 0°. Hip flexion contracture 10°.' : undefined,
          strength: s.code === 'KR-0001' ? 'Hip abductors and extensors 3/5 bilaterally.' : undefined,
          balance: s.code === 'KR-0001' ? 'Poor static standing balance, wide base of support.' : undefined,
          gait: s.code === 'KR-0001' ? 'Crouch gait with toe-strike; requires walker.' : undefined,
          painScore: 0,
          pain: 'No pain reported.',
          clinicalNotes: `Initial assessment for ${s.diagnosis}. Plan reviewed with family.`,
        },
      });
    }

    if (!s.plan) continue;
    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId: patient.id,
        title: s.plan.title,
        primaryObjective: s.plan.objective,
        startDate: dateOnly(at(-s.plan.startDaysAgo)),
        reviewDate: dateOnly(at(s.plan.reviewInDays)),
        recommendedFrequency: s.plan.frequency,
        expectedDuration: s.plan.duration,
        status: TreatmentPlanStatus.ACTIVE,
        createdBy: doctor.id,
        updatedBy: doctor.id,
      },
    });

    const metrics: Array<{ id: string; goal: GoalSpec; goalId: string }> = [];
    for (const g of s.goals ?? []) {
      const last = g.values[g.values.length - 1];
      const goal = await prisma.treatmentGoal.create({
        data: {
          treatmentPlanId: plan.id,
          title: g.title,
          metricName: g.metricName,
          unit: g.unit,
          direction: g.direction ?? MetricDirection.INCREASE_IS_BETTER,
          baselineValue: g.baseline,
          targetValue: g.target,
          currentValue: last,
          targetDate: dateOnly(at(g.targetInDays)),
          status: g.values.length > 1 ? GoalStatus.IN_PROGRESS : GoalStatus.NOT_STARTED,
          createdBy: doctor.id,
          updatedBy: doctor.id,
        },
      });
      const metric = await prisma.progressMetric.create({
        data: {
          patientId: patient.id,
          treatmentGoalId: goal.id,
          name: g.metricName,
          unit: g.unit,
          direction: g.direction ?? MetricDirection.INCREASE_IS_BETTER,
          baselineValue: g.baseline,
          targetValue: g.target,
        },
      });
      metrics.push({ id: metric.id, goal: g, goalId: goal.id });
    }

    const moods = [Mood.CALM, Mood.HAPPY, Mood.NEUTRAL, Mood.HAPPY, Mood.HAPPY];
    const assistance = [AssistanceLevel.MODERATE, AssistanceLevel.MODERATE, AssistanceLevel.MINIMAL, AssistanceLevel.MINIMAL, AssistanceLevel.SUPERVISION];
    for (const [i, day] of (s.sessionDays ?? []).entries()) {
      const date = at(day, 8 + (i % 3));
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          therapistId: therapist.id,
          startAt: date,
          durationMinutes: 45,
          status: AppointmentStatus.COMPLETED,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });
      const session = await prisma.therapySession.create({
        data: {
          patientId: patient.id,
          therapistId: therapist.id,
          appointmentId: appt.id,
          sessionDate: date,
          durationMinutes: 45,
          painScore: i === 0 ? 2 : 1,
          energyLevel: 3 + (i % 3 === 2 ? 1 : 0),
          mood: moods[i % moods.length],
          tolerance: i === 0 ? Tolerance.FAIR : Tolerance.GOOD,
          assistanceLevel: assistance[Math.min(i, assistance.length - 1)],
          notes:
            s.code === 'KR-0001'
              ? [
                  'Baseline session. Stood 5 s with close supervision; walked 2 m with walker. Mother taught home program.',
                  'Better weight shift. Standing 9 s. Mild fatigue after walking.',
                  'Standing 15 s. Walked 5 m with hand-held assistance. Good engagement.',
                  'Standing 19 s. Began obstacle stepping. Parents report more cruising at home.',
                  'Standing 22 s – best so far. Walked 8 m with supervision only.',
                ][i]
              : 'Session completed as planned. Home exercises reviewed with guardian.',
          status: SessionStatus.COMPLETED,
          completedAt: date,
          createdBy: therapist.id,
          updatedBy: therapist.id,
          exercises: {
            create: (s.exercises ?? []).map((name, order) => ({
              exerciseId: exercises[name].id,
              exerciseName: name,
              sets: exercises[name].defaultSets,
              repetitions: exercises[name].defaultRepetitions,
              durationSeconds: exercises[name].defaultDurationSeconds,
              sortOrder: order,
            })),
          },
        },
      });
      for (const m of metrics) {
        const value = m.goal.values[i];
        if (value === undefined) continue;
        await prisma.progressMeasurement.create({
          data: { progressMetricId: m.id, therapySessionId: session.id, value, measuredAt: date, recordedBy: therapist.id },
        });
      }
    }
  }

  // ---- Upcoming & missed appointments ---------------------------------------
  const schedule: Array<[code: string, day: number, hh: number, mm: number, status?: AppointmentStatus]> = [
    // Today (US-050): 08:00 Nguyen Van A, 09:00 Tran Thi B, 10:00 Le Van C
    ['KR-0001', 0, 8, 0, AppointmentStatus.CONFIRMED],
    ['KR-0002', 0, 9, 0, AppointmentStatus.SCHEDULED],
    ['KR-0003', 0, 10, 0, AppointmentStatus.SCHEDULED],
    ['KR-0004', 0, 8, 30, AppointmentStatus.CONFIRMED],
    ['KR-0006', 0, 14, 0, AppointmentStatus.SCHEDULED],
    ['KR-0007', 0, 15, 0, AppointmentStatus.SCHEDULED],
    // Rest of the next two weeks
    ['KR-0001', 2, 8, 0],
    ['KR-0001', 4, 8, 0],
    ['KR-0002', 3, 9, 0],
    ['KR-0003', 3, 10, 0],
    ['KR-0004', 3, 8, 30],
    ['KR-0005', 1, 16, 0],
    ['KR-0005', 8, 16, 0],
    ['KR-0006', 2, 14, 0],
    ['KR-0006', 4, 14, 0],
    ['KR-0008', 1, 10, 30],
    ['KR-0008', 7, 10, 30],
    ['KR-0007', 7, 15, 0],
    // Missed
    ['KR-0005', -10, 16, 0, AppointmentStatus.NO_SHOW],
    ['KR-0008', -6, 10, 30, AppointmentStatus.NO_SHOW],
    ['KR-0002', -18, 9, 0, AppointmentStatus.CANCELLED],
  ];
  for (const [code, day, hh, mm, status] of schedule) {
    const p = patients[code];
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: p.id,
        therapistId: p.therapistId,
        startAt: at(day, hh, mm),
        durationMinutes: 45,
        status: status ?? AppointmentStatus.SCHEDULED,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
  }

  // A second clinic proves data isolation in demos/tests: its users must never see clinic 1 data.
  const other = await prisma.clinic.create({ data: { name: 'Other Clinic (isolation check)', timezone: TZ } });
  const otherDoctor = await prisma.user.create({
    data: { clinicId: other.id, email: 'doctor@other-clinic.vn', fullName: 'Dr. Other Clinic', role: Role.DOCTOR, passwordHash },
  });
  await prisma.patient.create({
    data: {
      clinicId: other.id,
      patientCode: 'OT-0001',
      firstName: 'Khac',
      lastName: 'Benh Nhan',
      dateOfBirth: dateOnly(yearsAgo(6)),
      createdBy: otherDoctor.id,
      updatedBy: otherDoctor.id,
      guardians: { create: { fullName: 'Phu Huynh', relationship: 'Mother', phone: '0900 000 000', isPrimary: true } },
    },
  });

  console.log('Seed complete.');
  console.log(`  Clinic: ${clinic.name}`);
  console.log(`  Logins (password "${DEMO_PASSWORD}"):`);
  for (const email of ['admin@kidrehab.vn', 'doctor@kidrehab.vn', 'therapist1@kidrehab.vn', 'therapist2@kidrehab.vn', 'reception@kidrehab.vn']) {
    console.log(`    ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
