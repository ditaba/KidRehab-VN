import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { SessionStatus, TreatmentPlanStatus } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { CLINICAL_ROLES, CurrentUser, Roles } from '../common/decorators';
import { withProgress } from '../common/goal-view';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * US-060 / US-061: every goal with baseline, current, target, % toward target and
   * its chronologically sorted measurements. Only measurements from completed
   * sessions are included so drafts never show up in clinical progress.
   */
  async forPatient(user: AuthUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { patientId },
      orderBy: [{ startDate: 'desc' }],
      include: {
        goals: {
          orderBy: { createdAt: 'asc' },
          include: {
            metric: {
              include: {
                measurements: {
                  where: { OR: [{ therapySessionId: null }, { session: { status: SessionStatus.COMPLETED } }] },
                  orderBy: { measuredAt: 'asc' },
                  include: {
                    session: { select: { id: true, sessionDate: true, therapist: { select: { fullName: true } } } },
                    recorder: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    plans.sort((a, b) => Number(b.status === TreatmentPlanStatus.ACTIVE) - Number(a.status === TreatmentPlanStatus.ACTIVE));

    const goals = plans.flatMap((plan) =>
      plan.goals.map(({ metric, ...goal }) => ({
        ...withProgress(goal),
        plan: { id: plan.id, title: plan.title, status: plan.status },
        metric: metric ? { id: metric.id, name: metric.name, unit: metric.unit } : null,
        measurements: (metric?.measurements ?? []).map((m) => ({
          id: m.id,
          value: m.value,
          measuredAt: m.measuredAt,
          sessionId: m.session?.id ?? null,
          sessionDate: m.session?.sessionDate ?? null,
          therapist: m.session?.therapist.fullName ?? m.recorder.fullName,
          notes: m.notes,
        })),
      })),
    );
    return { patientId, goals };
  }
}

@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('patients/:id/progress')
  @Roles(...CLINICAL_ROLES)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.progress.forPatient(user, id);
  }
}

@Module({ controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
