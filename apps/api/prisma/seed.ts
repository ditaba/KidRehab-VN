/**
 * Demo seed: 1 clinic, admin, doctor, 2 therapists, receptionist, 10 patients,
 * exercise templates, sessions and progress measurements.
 *
 * Demo content is in Vietnamese, as a Vietnamese clinic would enter it.
 *
 * Demo patient "Nguyen Van A" (5 y, cerebral palsy) has the rich history used in product demos:
 *   Thời gian đứng 5 → 22 giây (target 30), Quãng đường đi 2 → 8 m (target 10).
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
      name: 'Trung tâm Phục hồi chức năng Nhi KidRehab Sài Gòn',
      address: '123 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
      phone: '028 3930 0000',
      timezone: TZ,
      defaultAppointmentMinutes: 45,
      reassessmentIntervalDays: 90,
    },
  });

  const mkUser = (email: string, fullName: string, role: Role) =>
    prisma.user.create({ data: { clinicId: clinic.id, email, fullName, role, passwordHash } });

  const admin = await mkUser('admin@kidrehab.vn', 'Vo Thanh Tam', Role.ADMIN);
  const doctor = await mkUser('doctor@kidrehab.vn', 'BS. Nguyen Thanh Hai', Role.DOCTOR);
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
      name: 'Thăng bằng đứng',
      category: ExerciseCategory.BALANCE,
      description: 'Đứng tĩnh, giảm dần hỗ trợ để tăng kiểm soát tư thế.',
      instructions: 'Trẻ đứng trên mặt phẳng cứng, hai chân rộng bằng hông. Giảm dần hỗ trợ bằng tay. Luôn đứng trong tầm với của trẻ.',
      sets: 3,
      duration: 30,
    },
    {
      name: 'Ngồi – đứng',
      category: ExerciseCategory.STRENGTH,
      description: 'Tăng sức mạnh chức năng chi dưới từ tư thế ngồi ghế băng.',
      instructions: 'Dùng ghế băng cao ngang gối. Bàn chân đặt phẳng, nghiêng người ra trước, đẩy lên đứng rồi ngồi xuống chậm.',
      sets: 3,
      reps: 10,
    },
    {
      name: 'Tập đi có hỗ trợ',
      category: ExerciseCategory.WALKING,
      description: 'Tập dáng đi với khung tập đi hoặc người cầm tay hỗ trợ.',
      instructions: 'Đi dọc đường tập 10 m. Ghi lại quãng đường và mức hỗ trợ. Nhắc trẻ đặt gót chân trước.',
      sets: 2,
      duration: 120,
    },
    {
      name: 'Kéo giãn cơ đùi sau',
      category: ExerciseCategory.STRETCHING,
      description: 'Kéo giãn cơ đùi sau thụ động/chủ động có trợ giúp ở tư thế ngồi duỗi chân.',
      instructions: 'Giữ mỗi lần kéo giãn nhẹ nhàng trong 30 giây. Không bao giờ cố ép khi trẻ đau.',
      sets: 3,
      duration: 30,
    },
    {
      name: 'Bắt và ném bóng',
      category: ExerciseCategory.COORDINATION,
      description: 'Phối hợp hai bên và tích hợp thị giác – vận động.',
      instructions: 'Dùng bóng mềm 20 cm ở khoảng cách 1–2 m. Tăng dần bằng bóng nhỏ hơn hoặc khoảng cách xa hơn.',
      sets: 2,
      reps: 10,
    },
    {
      name: 'Nhón gót',
      category: ExerciseCategory.STRENGTH,
      description: 'Tăng sức mạnh cơ bắp chân có hỗ trợ.',
      instructions: 'Bám tay vịn, nhón lên mũi chân, giữ 2 giây rồi hạ xuống chậm.',
      sets: 3,
      reps: 12,
    },
    {
      name: 'Bò qua đường hầm',
      category: ExerciseCategory.MOBILITY,
      description: 'Bò luân phiên tay chân qua đường hầm đồ chơi.',
      instructions: 'Khuyến khích trẻ bò bốn điểm qua đường hầm 2 m. Dùng đồ chơi để tạo động lực.',
      sets: 3,
      reps: 3,
    },
    {
      name: 'Nằm sấp với tay',
      category: ExerciseCategory.OTHER,
      description: 'Chịu trọng lượng ở tư thế nằm sấp kết hợp với tay (mẫu đã lưu trữ).',
      instructions: 'Phòng khám đã thay bằng bài Bò qua đường hầm.',
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
        status: e.name === 'Nằm sấp với tay' ? 'DISABLED' : 'ACTIVE',
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
      diagnosis: 'Bại não – liệt cứng hai chi dưới (GMFCS II)',
      icd: 'G80.1',
      therapist: 'T1',
      guardian: { fullName: 'Nguyen Thi Mai', relationship: 'Mother', phone: '0903 123 456', email: 'mai.nguyen@example.com' },
      medicalNotes: 'Sinh non 32 tuần. Mang nẹp cổ bàn chân (AFO) hai bên. Không co giật.',
      assessedDaysAgo: 64,
      plan: {
        title: 'Tự đứng và tự đi',
        objective: 'Cải thiện thăng bằng khi đứng và quãng đường tự đi để di chuyển ở nhà và ở trường mầm non.',
        frequency: '3 buổi/tuần',
        duration: '6 tháng',
        startDaysAgo: 63,
        reviewInDays: 30,
      },
      goals: [
        {
          title: 'Tự đứng không hỗ trợ',
          metricName: 'Thời gian đứng',
          unit: 'giây',
          baseline: 5,
          target: 30,
          targetInDays: 37,
          values: [5, 9, 15, 19, 22],
        },
        {
          title: 'Tự đi lại trong nhà',
          metricName: 'Quãng đường đi',
          unit: 'm',
          baseline: 2,
          target: 10,
          targetInDays: 60,
          values: [2, 3.5, 5, 6.5, 8],
        },
      ],
      sessionDays: [-62, -52, -35, -21, -1],
      exercises: ['Thăng bằng đứng', 'Tập đi có hỗ trợ', 'Ngồi – đứng'],
    },
    {
      code: 'KR-0002',
      lastName: 'Tran',
      firstName: 'Thi B',
      dob: yearsAgo(4, 100),
      gender: Gender.FEMALE,
      diagnosis: 'Chậm phát triển toàn thể',
      icd: 'F88',
      therapist: 'T1',
      guardian: { fullName: 'Tran Van Hung', relationship: 'Father', phone: '0912 222 333' },
      assessedDaysAgo: 40,
      plan: {
        title: 'Phát triển vận động thô',
        objective: 'Đạt được chuyển tư thế ngồi – đứng và ngồi xổm – đứng phù hợp với tuổi.',
        frequency: '2 buổi/tuần',
        duration: '4 tháng',
        startDaysAgo: 38,
        reviewInDays: 45,
      },
      goals: [
        {
          title: 'Tự ngồi – đứng',
          metricName: 'Số lần ngồi – đứng (30 giây)',
          unit: 'lần',
          baseline: 2,
          target: 8,
          targetInDays: 80,
          values: [2, 3, 4, 5],
        },
      ],
      sessionDays: [-35, -24, -14, -4],
      exercises: ['Ngồi – đứng', 'Bò qua đường hầm'],
    },
    {
      code: 'KR-0003',
      lastName: 'Le',
      firstName: 'Van C',
      dob: yearsAgo(7, 15),
      gender: Gender.MALE,
      diagnosis: 'Hội chứng Down kèm giảm trương lực cơ',
      icd: 'Q90.9',
      therapist: 'T1',
      guardian: { fullName: 'Le Thi Thu', relationship: 'Mother', phone: '0987 654 321' },
      assessedDaysAgo: 120, // overdue for reassessment
      plan: {
        title: 'Thăng bằng và sức bền',
        objective: 'Cải thiện thăng bằng trên một chân và sức bền khi đi.',
        frequency: '2 buổi/tuần',
        duration: '6 tháng',
        startDaysAgo: 118,
        reviewInDays: -5,
      },
      goals: [
        {
          title: 'Đứng một chân',
          metricName: 'Thời gian đứng một chân',
          unit: 'giây',
          baseline: 1,
          target: 10,
          targetInDays: 60,
          values: [1, 2, 3, 3, 4],
        },
      ],
      sessionDays: [-110, -80, -50, -30, -9],
      exercises: ['Thăng bằng đứng', 'Nhón gót'],
    },
    {
      code: 'KR-0004',
      lastName: 'Pham',
      firstName: 'Minh D',
      dob: yearsAgo(3, 20),
      gender: Gender.MALE,
      diagnosis: 'Vẹo cổ bẩm sinh do cơ',
      icd: 'Q68.0',
      therapist: 'T2',
      guardian: { fullName: 'Pham Thi Hoa', relationship: 'Mother', phone: '0905 111 222' },
      assessedDaysAgo: 30,
      plan: {
        title: 'Tầm vận động cổ',
        objective: 'Phục hồi đủ tầm xoay cổ và giảm nghiêng đầu.',
        frequency: '2 buổi/tuần',
        duration: '3 tháng',
        startDaysAgo: 28,
        reviewInDays: 60,
      },
      goals: [
        {
          title: 'Giảm nghiêng đầu',
          metricName: 'Góc nghiêng đầu',
          unit: '°',
          baseline: 15,
          target: 3,
          direction: MetricDirection.DECREASE_IS_BETTER,
          targetInDays: 60,
          values: [15, 12, 10],
        },
      ],
      sessionDays: [-25, -14, -3],
      exercises: ['Kéo giãn cơ đùi sau'],
    },
    {
      code: 'KR-0005',
      lastName: 'Hoang',
      firstName: 'Thi E',
      dob: yearsAgo(6, 200),
      gender: Gender.FEMALE,
      diagnosis: 'Rối loạn phổ tự kỷ – khó khăn phối hợp vận động',
      icd: 'F84.0',
      therapist: 'T2',
      guardian: { fullName: 'Hoang Van Nam', relationship: 'Father', phone: '0938 777 888' },
      assessedDaysAgo: 20,
      plan: {
        title: 'Phối hợp vận động khi chơi',
        objective: 'Cải thiện kỹ năng chơi bóng để tham gia chơi nhóm.',
        frequency: '1 buổi/tuần',
        duration: '3 tháng',
        startDaysAgo: 18,
        reviewInDays: 70,
      },
      goals: [
        {
          title: 'Bắt bóng ở khoảng cách 2 m',
          metricName: 'Số lần bắt bóng thành công (trên 10)',
          unit: 'lần bắt',
          baseline: 2,
          target: 8,
          targetInDays: 70,
          values: [2, 4],
        },
      ],
      sessionDays: [-14, -7],
      exercises: ['Bắt và ném bóng'],
    },
    {
      code: 'KR-0006',
      lastName: 'Vu',
      firstName: 'Duc F',
      dob: yearsAgo(8, 50),
      gender: Gender.MALE,
      diagnosis: 'Phục hồi chức năng sau phẫu thuật – gãy xương chày',
      icd: 'S82.2',
      therapist: 'T2',
      guardian: { fullName: 'Vu Thi Lien', relationship: 'Grandparent', phone: '0909 333 444' },
      assessedDaysAgo: 10,
      plan: {
        title: 'Chịu lực hoàn toàn trở lại',
        objective: 'Phục hồi tầm vận động gối và dáng đi bình thường.',
        frequency: '3 buổi/tuần',
        duration: '8 tuần',
        startDaysAgo: 9,
        reviewInDays: 20,
      },
      goals: [
        {
          title: 'Tầm gấp gối',
          metricName: 'Góc gấp gối',
          unit: '°',
          baseline: 70,
          target: 130,
          targetInDays: 45,
          values: [70, 85],
        },
      ],
      sessionDays: [-8, -2],
      exercises: ['Nhón gót', 'Tập đi có hỗ trợ'],
    },
    {
      code: 'KR-0007',
      lastName: 'Dang',
      firstName: 'Ngoc G',
      dob: yearsAgo(2, 30),
      gender: Gender.FEMALE,
      diagnosis: 'Liệt đám rối thần kinh cánh tay do sinh (liệt Erb)',
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
      diagnosis: 'Đi nhón gót vô căn',
      icd: 'R26.89',
      therapist: 'T2',
      guardian: { fullName: 'Bui Thi Ngoc', relationship: 'Mother', phone: '0977 121 212' },
      assessedDaysAgo: 50,
      plan: {
        title: 'Dáng đi gót – mũi chân',
        objective: 'Tăng gập mu cổ chân và đặt gót chân khi đi.',
        frequency: '2 buổi/tuần',
        duration: '3 tháng',
        startDaysAgo: 48,
        reviewInDays: 40,
      },
      goals: [
        {
          title: 'Gập mu cổ chân',
          metricName: 'Góc gập mu cổ chân',
          unit: '°',
          baseline: -5,
          target: 10,
          targetInDays: 50,
          values: [-5, 0, 3],
        },
      ],
      sessionDays: [-45, -30, -16],
      exercises: ['Kéo giãn cơ đùi sau', 'Nhón gót'],
    },
    {
      code: 'KR-0009',
      lastName: 'Do',
      firstName: 'Thu I',
      dob: yearsAgo(5, 300),
      gender: Gender.FEMALE,
      status: PatientStatus.INACTIVE,
      diagnosis: 'Tật nứt đốt sống (thoát vị tủy – màng tủy vùng thắt lưng)',
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
      diagnosis: 'Viêm khớp tự phát thiếu niên',
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
          medicalHistory: s.medicalNotes ?? 'Tiền sử chu sinh bình thường.',
          developmentHistory:
            s.code === 'KR-0001'
              ? 'Tự ngồi lúc 14 tháng. Chưa tự đi được. Vịn đồ đạc để đi men.'
              : 'Theo phụ huynh, các mốc phát triển chậm nhẹ.',
          functionalAbility:
            s.code === 'KR-0001'
              ? 'Đứng được khi có hỗ trợ; tự đứng khoảng 5 giây. Đi khoảng 2 m với khung tập đi sau lưng.'
              : 'Xem mục tiêu.',
          rangeOfMotion: s.code === 'KR-0001' ? 'Gập mu cổ chân hai bên giới hạn ở 0°. Co rút gấp háng 10°.' : undefined,
          strength: s.code === 'KR-0001' ? 'Cơ dạng và cơ duỗi háng 3/5 hai bên.' : undefined,
          balance: s.code === 'KR-0001' ? 'Thăng bằng đứng tĩnh kém, chân đế rộng.' : undefined,
          gait: s.code === 'KR-0001' ? 'Dáng đi khom gối, chạm mũi chân trước; cần khung tập đi.' : undefined,
          painScore: 0,
          pain: 'Không ghi nhận đau.',
          clinicalNotes: `Đánh giá ban đầu: ${s.diagnosis}. Đã trao đổi kế hoạch với gia đình.`,
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
                  'Buổi đo ban đầu. Đứng 5 giây với giám sát sát; đi 2 m với khung tập đi. Đã hướng dẫn mẹ bài tập tại nhà.',
                  'Chuyển trọng tâm tốt hơn. Đứng 9 giây. Mệt nhẹ sau khi đi.',
                  'Đứng 15 giây. Đi 5 m có người cầm tay. Hợp tác tốt.',
                  'Đứng 19 giây. Bắt đầu tập bước qua vật cản. Phụ huynh cho biết ở nhà bé vịn đi men nhiều hơn.',
                  'Đứng 22 giây – tốt nhất từ trước đến nay. Đi 8 m chỉ cần giám sát.',
                ][i]
              : 'Hoàn thành buổi tập theo kế hoạch. Đã ôn lại bài tập tại nhà với người giám hộ.',
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
  const other = await prisma.clinic.create({ data: { name: 'Phòng khám khác (kiểm tra tách dữ liệu)', timezone: TZ } });
  const otherDoctor = await prisma.user.create({
    data: { clinicId: other.id, email: 'doctor@other-clinic.vn', fullName: 'BS. Phòng Khám Khác', role: Role.DOCTOR, passwordHash },
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
