import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  AuditAction,
  ExerciseStatus,
  GoalStatus,
  Prisma,
  Role,
  SessionStatus,
  TreatmentPlanStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { withProgress } from '../common/goal-view';
import { paginated } from '../common/pagination';
import { ageInYears, dayRange } from '../common/time';
import { publicUserSelect } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddSessionExerciseDto,
  CreateSessionDto,
  ListSessionsQuery,
  RecordMeasurementDto,
  UpdateSessionDto,
  UpdateSessionExerciseDto,
} from './sessions.dto';

const measurementInclude = {
  metric: { select: { id: true, name: true, unit: true, treatmentGoalId: true } },
} as const;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** US-050: today's appointments for the therapist (or the whole clinic for doctors/admins). */
  async today(user: AuthUser, therapistId?: string) {
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId } });
    const { start, end } = dayRange(new Date(), clinic.timezone);
    const forTherapist = user.role === Role.THERAPIST ? user.id : therapistId;

    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startAt: { gte: start, lt: end },
        status: { not: AppointmentStatus.CANCELLED },
        therapistId: forTherapist,
      },
      orderBy: { startAt: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            dateOfBirth: true,
            diagnoses: { where: { isPrimary: true }, take: 1, select: { name: true } },
          },
        },
        therapist: { select: publicUserSelect },
        session: { select: { id: true, status: true } },
      },
    });

    // Walk-in sessions started today without an appointment.
    const walkIns = await this.prisma.therapySession.findMany({
      where: {
        appointmentId: null,
        sessionDate: { gte: start, lt: end },
        therapistId: forTherapist,
        patient: { clinicId: user.clinicId },
      },
      orderBy: { sessionDate: 'asc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        therapist: { select: publicUserSelect },
      },
    });

    return {
      date: start,
      timezone: clinic.timezone,
      appointments: appointments.map(({ patient, ...a }) => ({
        ...a,
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          patientCode: patient.patientCode,
          age: ageInYears(patient.dateOfBirth),
          diagnosis: patient.diagnoses[0]?.name ?? null,
        },
      })),
      walkIns,
    };
  }

  async list(user: AuthUser, q: ListSessionsQuery) {
    const where: Prisma.TherapySessionWhereInput = {
      patient: this.access.patientScope(user),
      status: q.status,
      therapistId: q.therapistId,
      patientId: q.patientId,
    };
    const [data, total] = await Promise.all([
      this.prisma.therapySession.findMany({
        where,
        orderBy: { sessionDate: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
          therapist: { select: publicUserSelect },
          measurements: { include: measurementInclude },
          _count: { select: { exercises: true, measurements: true } },
        },
      }),
      this.prisma.therapySession.count({ where }),
    ]);
    return paginated(data, total, q.page, q.pageSize);
  }

  async listForPatient(user: AuthUser, patientId: string, q: ListSessionsQuery) {
    await this.access.assertPatient(user, patientId);
    return this.list(user, { ...q, patientId });
  }

  async create(user: AuthUser, patientId: string, dto: CreateSessionDto) {
    await this.access.assertPatient(user, patientId);

    let therapistId = user.id;
    if (user.role !== Role.THERAPIST && dto.therapistId) {
      therapistId = (await this.access.assertStaff(user, dto.therapistId, [Role.THERAPIST, Role.DOCTOR])).id;
    }

    let durationMinutes: number | undefined;
    const sessionDate = dto.sessionDate ? new Date(dto.sessionDate) : new Date();
    if (dto.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, clinicId: user.clinicId, patientId },
        include: { session: true },
      });
      if (!appt) throw new NotFoundException('Appointment not found for this patient');
      // "Start Session" is idempotent: re-opening an appointment returns its existing session.
      if (appt.session) return this.findOne(user, appt.session.id);
      if (appt.status === AppointmentStatus.CANCELLED) throw new ConflictException('Appointment is cancelled');
      durationMinutes = appt.durationMinutes;
      // A doctor starting a session from an appointment documents it for the booked therapist.
      if (user.role !== Role.THERAPIST && !dto.therapistId) therapistId = appt.therapistId;
    }

    const session = await this.prisma.therapySession.create({
      data: {
        patientId,
        therapistId,
        appointmentId: dto.appointmentId,
        sessionDate,
        durationMinutes,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await this.audit.log(user, AuditAction.CREATE, 'TherapySession', session.id, { patientId });
    return this.findOne(user, session.id);
  }

  async findOne(user: AuthUser, id: string) {
    await this.access.assertSession(user, id);
    const session = await this.prisma.therapySession.findUniqueOrThrow({
      where: { id },
      include: {
        therapist: { select: publicUserSelect },
        appointment: { select: { id: true, startAt: true, durationMinutes: true, status: true } },
        exercises: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        measurements: { include: measurementInclude, orderBy: { measuredAt: 'asc' } },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            dateOfBirth: true,
            diagnoses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { id: true, name: true, isPrimary: true } },
          },
        },
      },
    });

    const [activePlan, previous] = await Promise.all([
      this.prisma.treatmentPlan.findFirst({
        where: { patientId: session.patientId, status: TreatmentPlanStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
        include: {
          goals: {
            where: { status: { in: [GoalStatus.NOT_STARTED, GoalStatus.IN_PROGRESS] } },
            orderBy: { createdAt: 'asc' },
            include: { metric: { select: { id: true, name: true, unit: true } } },
          },
        },
      }),
      this.prisma.therapySession.findFirst({
        where: {
          patientId: session.patientId,
          status: SessionStatus.COMPLETED,
          id: { not: id },
          sessionDate: { lte: session.sessionDate },
        },
        orderBy: { sessionDate: 'desc' },
        include: {
          therapist: { select: publicUserSelect },
          exercises: { select: { exerciseName: true, sets: true, repetitions: true, durationSeconds: true } },
          measurements: { include: measurementInclude },
        },
      }),
    ]);

    return {
      ...session,
      patient: { ...session.patient, age: ageInYears(session.patient.dateOfBirth) },
      goals: activePlan?.goals.map(withProgress) ?? [],
      activePlan: activePlan ? { id: activePlan.id, title: activePlan.title } : null,
      previousSession: previous,
    };
  }

  async update(user: AuthUser, id: string, dto: UpdateSessionDto) {
    const session = await this.editableSession(user, id);
    await this.prisma.therapySession.update({
      where: { id: session.id },
      data: {
        ...dto,
        sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : undefined,
        updatedBy: user.id,
      },
    });
    if (dto.sessionDate) {
      await this.prisma.progressMeasurement.updateMany({
        where: { therapySessionId: id },
        data: { measuredAt: new Date(dto.sessionDate) },
      });
    }
    await this.audit.log(user, AuditAction.UPDATE, 'TherapySession', id, { fields: Object.keys(dto), status: dto.status });
    return this.findOne(user, id);
  }

  // ---- Exercises -------------------------------------------------------------

  async addExercise(user: AuthUser, id: string, dto: AddSessionExerciseDto) {
    await this.editableSession(user, id);
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: dto.exerciseId, clinicId: user.clinicId },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    if (exercise.status !== ExerciseStatus.ACTIVE) throw new ConflictException('This exercise is disabled');
    const count = await this.prisma.sessionExercise.count({ where: { sessionId: id } });

    // Prescription values are copied from the template; editing them later never touches the template.
    const se = await this.prisma.sessionExercise.create({
      data: {
        sessionId: id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: dto.sets ?? exercise.defaultSets,
        repetitions: dto.repetitions ?? exercise.defaultRepetitions,
        durationSeconds: dto.durationSeconds ?? exercise.defaultDurationSeconds,
        notes: dto.notes,
        sortOrder: count,
      },
    });
    await this.touch(user, id);
    return se;
  }

  async updateExercise(user: AuthUser, id: string, sessionExerciseId: string, dto: UpdateSessionExerciseDto) {
    await this.editableSession(user, id);
    await this.findSessionExercise(id, sessionExerciseId);
    const se = await this.prisma.sessionExercise.update({ where: { id: sessionExerciseId }, data: dto });
    await this.touch(user, id);
    return se;
  }

  async removeExercise(user: AuthUser, id: string, sessionExerciseId: string) {
    await this.editableSession(user, id);
    await this.findSessionExercise(id, sessionExerciseId);
    await this.prisma.sessionExercise.delete({ where: { id: sessionExerciseId } });
    await this.touch(user, id);
  }

  // ---- Measurements ----------------------------------------------------------

  /** Records (or corrects) the value of one metric for this session. */
  async recordMeasurement(user: AuthUser, id: string, dto: RecordMeasurementDto) {
    const session = await this.editableSession(user, id);
    const metric = await this.prisma.progressMetric.findFirst({
      where: { id: dto.progressMetricId, patientId: session.patientId },
    });
    if (!metric) throw new NotFoundException('Metric not found for this patient');

    const m = await this.prisma.progressMeasurement.upsert({
      where: { progressMetricId_therapySessionId: { progressMetricId: metric.id, therapySessionId: id } },
      create: {
        progressMetricId: metric.id,
        therapySessionId: id,
        value: dto.value,
        notes: dto.notes,
        measuredAt: session.sessionDate,
        recordedBy: user.id,
      },
      update: { value: dto.value, notes: dto.notes, recordedBy: user.id },
      include: measurementInclude,
    });
    await this.audit.log(user, AuditAction.CREATE, 'ProgressMeasurement', m.id, {
      sessionId: id,
      metric: metric.name,
      value: dto.value,
    });
    return m;
  }

  async removeMeasurement(user: AuthUser, id: string, measurementId: string) {
    await this.editableSession(user, id);
    const m = await this.prisma.progressMeasurement.findFirst({ where: { id: measurementId, therapySessionId: id } });
    if (!m) throw new NotFoundException('Measurement not found');
    await this.prisma.progressMeasurement.delete({ where: { id: measurementId } });
    await this.audit.log(user, AuditAction.DELETE, 'ProgressMeasurement', measurementId, { sessionId: id });
  }

  // ---- Completion ------------------------------------------------------------

  /**
   * US-054: marks the session COMPLETED, then updates each measured goal's current value
   * from its latest measurement (by date) among completed sessions.
   */
  async complete(user: AuthUser, id: string, dto: UpdateSessionDto) {
    const session = await this.editableSession(user, id);
    if (dto.status) throw new BadRequestException('Status cannot be changed while completing');

    await this.prisma.$transaction(async (tx) => {
      await tx.therapySession.update({
        where: { id },
        data: {
          ...dto,
          sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : undefined,
          status: SessionStatus.COMPLETED,
          completedAt: new Date(),
          updatedBy: user.id,
        },
      });
      if (dto.sessionDate) {
        await tx.progressMeasurement.updateMany({
          where: { therapySessionId: id },
          data: { measuredAt: new Date(dto.sessionDate) },
        });
      }

      const measured = await tx.progressMeasurement.findMany({
        where: { therapySessionId: id },
        select: { progressMetricId: true },
      });
      for (const { progressMetricId } of measured) {
        await this.refreshGoalCurrentValue(tx, user, progressMetricId);
      }

      if (session.appointmentId) {
        await tx.appointment.update({
          where: { id: session.appointmentId },
          data: { status: AppointmentStatus.COMPLETED, updatedBy: user.id },
        });
      }
      await this.audit.log(user, AuditAction.COMPLETE, 'TherapySession', id, { measurements: measured.length }, tx);
    });
    return this.findOne(user, id);
  }

  private async refreshGoalCurrentValue(tx: Prisma.TransactionClient, user: AuthUser, metricId: string) {
    const metric = await tx.progressMetric.findUniqueOrThrow({
      where: { id: metricId },
      include: { treatmentGoal: true },
    });
    if (!metric.treatmentGoal) return;
    const latest = await tx.progressMeasurement.findFirst({
      where: {
        progressMetricId: metricId,
        OR: [{ therapySessionId: null }, { session: { status: SessionStatus.COMPLETED } }],
      },
      orderBy: [{ measuredAt: 'desc' }],
    });
    if (!latest) return;
    const goal = metric.treatmentGoal;
    await tx.treatmentGoal.update({
      where: { id: goal.id },
      data: {
        currentValue: latest.value,
        // A goal with a first measurement is in progress; ACHIEVED/PAUSED/CANCELLED remain clinician decisions.
        status: goal.status === GoalStatus.NOT_STARTED ? GoalStatus.IN_PROGRESS : undefined,
        updatedBy: user.id,
      },
    });
    await this.audit.log(user, AuditAction.UPDATE, 'TreatmentGoal', goal.id, { currentValue: latest.value }, tx);
  }

  // ---- helpers ---------------------------------------------------------------

  private async editableSession(user: AuthUser, id: string) {
    const session = await this.access.assertSession(user, id);
    this.access.assertCanEditSession(user, session);
    if (session.status !== SessionStatus.DRAFT) {
      throw new ConflictException(`Session is ${session.status.toLowerCase()} and can no longer be edited`);
    }
    return session;
  }

  private async findSessionExercise(sessionId: string, id: string) {
    const se = await this.prisma.sessionExercise.findFirst({ where: { id, sessionId } });
    if (!se) throw new NotFoundException('Session exercise not found');
    return se;
  }

  private touch(user: AuthUser, id: string) {
    return this.prisma.therapySession.update({ where: { id }, data: { updatedBy: user.id } });
  }
}
