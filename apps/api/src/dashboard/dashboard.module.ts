import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { AppointmentStatus, PatientStatus, Prisma, Role, TreatmentPlanStatus } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles, STAFF_ROLES } from '../common/decorators';
import { ageInYears, dayRange } from '../common/time';
import { publicUserSelect } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

const MISSED_WINDOW_DAYS = 30;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** US-010: all figures are scoped to the user's clinic (and, for therapists, to their patients). */
  async summary(user: AuthUser) {
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId } });
    const now = new Date();
    const { start, end } = dayRange(now, clinic.timezone);
    const scope = this.access.patientScope(user);
    const therapistFilter = user.role === Role.THERAPIST ? user.id : undefined;

    const reassessCutoff = new Date(now.getTime() - clinic.reassessmentIntervalDays * 86400000);
    const needReassessmentWhere: Prisma.PatientWhereInput = {
      AND: [
        scope,
        { status: PatientStatus.ACTIVE },
        {
          OR: [
            { assessments: { none: { assessedAt: { gte: reassessCutoff } } } },
            { treatmentPlans: { some: { status: TreatmentPlanStatus.ACTIVE, reviewDate: { lte: now } } } },
          ],
        },
      ],
    };

    const missedFrom = new Date(start.getTime() - MISSED_WINDOW_DAYS * 86400000);
    const missedWhere: Prisma.AppointmentWhereInput = {
      clinicId: user.clinicId,
      therapistId: therapistFilter,
      startAt: { gte: missedFrom, lt: start },
      OR: [
        { status: AppointmentStatus.NO_SHOW },
        // Past appointments that were never completed or cancelled.
        { status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] }, session: null },
      ],
    };

    const todayWhere: Prisma.AppointmentWhereInput = {
      clinicId: user.clinicId,
      therapistId: therapistFilter,
      startAt: { gte: start, lt: end },
      status: { not: AppointmentStatus.CANCELLED },
    };

    const [activePatients, todayAppointments, needReassessment, needReassessmentPatients, missedAppointments] =
      await Promise.all([
        this.prisma.patient.count({ where: { AND: [scope, { status: PatientStatus.ACTIVE }] } }),
        this.prisma.appointment.findMany({
          where: todayWhere,
          orderBy: { startAt: 'asc' },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
            therapist: { select: publicUserSelect },
            session: { select: { id: true, status: true } },
          },
        }),
        this.prisma.patient.count({ where: needReassessmentWhere }),
        this.prisma.patient.findMany({
          where: needReassessmentWhere,
          take: 5,
          orderBy: { lastName: 'asc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            dateOfBirth: true,
            assessments: { orderBy: { assessedAt: 'desc' }, take: 1, select: { assessedAt: true } },
          },
        }),
        this.prisma.appointment.count({ where: missedWhere }),
      ]);

    return {
      generatedAt: now,
      timezone: clinic.timezone,
      stats: {
        activePatients,
        todaySessions: todayAppointments.length,
        todaySessionsCompleted: todayAppointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
        needReassessment,
        missedAppointments,
      },
      todayAppointments,
      needReassessmentPatients: needReassessmentPatients.map(({ assessments, dateOfBirth, ...p }) => ({
        ...p,
        age: ageInYears(dateOfBirth, now),
        lastAssessedAt: assessments[0]?.assessedAt ?? null,
      })),
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
