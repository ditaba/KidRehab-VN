import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, MetricDirection, Prisma, TreatmentPlanStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { withProgress } from '../common/goal-view';
import { isTargetConsistent } from '../common/progress';
import { toDateOnly } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto, CreateTreatmentPlanDto, UpdateGoalDto, UpdateTreatmentPlanDto } from './treatment.dto';

const goalInclude = { metric: { select: { id: true } } } as const;

@Injectable()
export class TreatmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async listPlans(user: AuthUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { patientId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: { goals: { orderBy: { createdAt: 'asc' }, include: goalInclude } },
    });
    // ACTIVE plan first, then historical plans.
    plans.sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'));
    return plans.map((p) => ({ ...p, goals: p.goals.map(withProgress) }));
  }

  async createPlan(user: AuthUser, patientId: string, dto: CreateTreatmentPlanDto) {
    await this.access.assertPatient(user, patientId);
    const status = dto.status ?? TreatmentPlanStatus.ACTIVE;
    this.assertDates(dto.startDate, dto.reviewDate);
    return this.prisma.$transaction(async (tx) => {
      if (status === TreatmentPlanStatus.ACTIVE) await this.completeOtherActivePlans(tx, user, patientId);
      const plan = await tx.treatmentPlan.create({
        data: {
          ...dto,
          status,
          startDate: toDateOnly(dto.startDate),
          reviewDate: dto.reviewDate ? toDateOnly(dto.reviewDate) : undefined,
          patientId,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: { goals: true },
      });
      await this.audit.log(user, AuditAction.CREATE, 'TreatmentPlan', plan.id, { patientId, status }, tx);
      return plan;
    });
  }

  async updatePlan(user: AuthUser, id: string, dto: UpdateTreatmentPlanDto) {
    const plan = await this.access.assertTreatmentPlan(user, id);
    this.assertDates(dto.startDate ?? plan.startDate.toISOString(), dto.reviewDate);
    return this.prisma.$transaction(async (tx) => {
      if (dto.status === TreatmentPlanStatus.ACTIVE && plan.status !== TreatmentPlanStatus.ACTIVE) {
        await this.completeOtherActivePlans(tx, user, plan.patientId, id);
      }
      const updated = await tx.treatmentPlan.update({
        where: { id },
        data: {
          ...dto,
          startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
          reviewDate: dto.reviewDate ? toDateOnly(dto.reviewDate) : undefined,
          updatedBy: user.id,
        },
        include: { goals: { orderBy: { createdAt: 'asc' }, include: goalInclude } },
      });
      await this.audit.log(user, AuditAction.UPDATE, 'TreatmentPlan', id, { fields: Object.keys(dto), status: dto.status }, tx);
      return { ...updated, goals: updated.goals.map(withProgress) };
    });
  }

  async createGoal(user: AuthUser, planId: string, dto: CreateGoalDto) {
    const plan = await this.access.assertTreatmentPlan(user, planId);
    const direction = dto.direction ?? MetricDirection.INCREASE_IS_BETTER;
    this.assertTarget(dto.baselineValue, dto.targetValue, direction);
    const metricName = dto.metricName || dto.title;

    return this.prisma.$transaction(async (tx) => {
      let existingMetricId: string | undefined;
      if (dto.progressMetricId) {
        const metric = await tx.progressMetric.findFirst({
          where: { id: dto.progressMetricId, patientId: plan.patientId },
        });
        if (!metric) throw new NotFoundException('Progress metric not found for this patient');
        existingMetricId = metric.id;
      }

      const { progressMetricId: _ignored, ...goalData } = dto;
      const goal = await tx.treatmentGoal.create({
        data: {
          ...goalData,
          metricName,
          direction,
          targetDate: dto.targetDate ? toDateOnly(dto.targetDate) : undefined,
          treatmentPlanId: planId,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      // Every goal is backed by a ProgressMetric so measurements can be charted.
      const metricData = {
        name: metricName,
        unit: dto.unit,
        direction,
        baselineValue: dto.baselineValue,
        targetValue: dto.targetValue,
        treatmentGoalId: goal.id,
      };
      if (existingMetricId) {
        await tx.progressMetric.update({ where: { id: existingMetricId }, data: metricData });
      } else {
        await tx.progressMetric.create({ data: { ...metricData, patientId: plan.patientId } });
      }

      await this.audit.log(user, AuditAction.CREATE, 'TreatmentGoal', goal.id, { treatmentPlanId: planId }, tx);
      const full = await tx.treatmentGoal.findUniqueOrThrow({ where: { id: goal.id }, include: goalInclude });
      return withProgress(full);
    });
  }

  async updateGoal(user: AuthUser, id: string, dto: UpdateGoalDto) {
    const goal = await this.access.assertGoal(user, id);
    const baseline = dto.baselineValue ?? goal.baselineValue;
    const target = dto.targetValue ?? goal.targetValue;
    const direction = dto.direction ?? goal.direction;
    this.assertTarget(baseline, target, direction);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.treatmentGoal.update({
        where: { id },
        data: {
          ...dto,
          targetDate: dto.targetDate ? toDateOnly(dto.targetDate) : undefined,
          updatedBy: user.id,
        },
        include: goalInclude,
      });
      const metricData = {
        name: updated.metricName,
        unit: updated.unit,
        direction: updated.direction,
        baselineValue: updated.baselineValue,
        targetValue: updated.targetValue,
      };
      if (goal.metric) {
        await tx.progressMetric.update({ where: { id: goal.metric.id }, data: metricData });
      } else {
        await tx.progressMetric.create({
          data: { ...metricData, patientId: goal.treatmentPlan.patientId, treatmentGoalId: id },
        });
      }
      await this.audit.log(
        user,
        AuditAction.UPDATE,
        'TreatmentGoal',
        id,
        { fields: Object.keys(dto), status: dto.status } as Prisma.InputJsonValue,
        tx,
      );
      return withProgress(updated);
    });
  }

  /** Only one plan is normally ACTIVE: activating a plan completes the previous active plan(s). */
  private async completeOtherActivePlans(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    patientId: string,
    exceptId?: string,
  ) {
    const others = await tx.treatmentPlan.findMany({
      where: { patientId, status: TreatmentPlanStatus.ACTIVE, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    for (const p of others) {
      await tx.treatmentPlan.update({
        where: { id: p.id },
        data: { status: TreatmentPlanStatus.COMPLETED, updatedBy: user.id },
      });
      await this.audit.log(user, AuditAction.UPDATE, 'TreatmentPlan', p.id, { status: 'COMPLETED', reason: 'superseded' }, tx);
    }
  }

  private assertTarget(baseline: number, target: number, direction: MetricDirection) {
    if (!isTargetConsistent(baseline, target, direction)) {
      throw new BadRequestException(
        direction === MetricDirection.INCREASE_IS_BETTER
          ? 'Target must be greater than baseline when an increase is better'
          : 'Target must be lower than baseline when a decrease is better',
      );
    }
  }

  private assertDates(start: string, review?: string) {
    if (review && toDateOnly(review) < toDateOnly(start)) {
      throw new BadRequestException('Review date must be on or after the start date');
    }
  }
}
