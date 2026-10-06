import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user';

/**
 * Central place for clinic isolation and therapist assignment rules.
 *
 * - Every patient lookup is scoped to the caller's clinic. A patient from another
 *   clinic is reported as "not found" so its existence is never revealed.
 * - Therapists only see patients assigned to them: the patient's primary therapist,
 *   or a patient they have an appointment or session with.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Extra `where` filter restricting a patient query to what the user may see. */
  patientScope(user: AuthUser): Prisma.PatientWhereInput {
    const base: Prisma.PatientWhereInput = { clinicId: user.clinicId };
    if (user.role !== Role.THERAPIST) return base;
    return {
      ...base,
      OR: [
        { primaryTherapistId: user.id },
        { appointments: { some: { therapistId: user.id } } },
        { therapySessions: { some: { therapistId: user.id } } },
      ],
    };
  }

  /** Throws NotFound unless the patient exists in the user's clinic and is visible to the user. */
  async assertPatient(user: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { AND: [{ id: patientId }, this.patientScope(user)] },
      select: { id: true, clinicId: true, primaryTherapistId: true, status: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async assertTreatmentPlan(user: AuthUser, planId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, patient: this.patientScope(user) },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return plan;
  }

  async assertGoal(user: AuthUser, goalId: string) {
    const goal = await this.prisma.treatmentGoal.findFirst({
      where: { id: goalId, treatmentPlan: { patient: this.patientScope(user) } },
      include: { treatmentPlan: { select: { patientId: true } }, metric: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async assertSession(user: AuthUser, sessionId: string) {
    const session = await this.prisma.therapySession.findFirst({
      where: { id: sessionId, patient: this.patientScope(user) },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  /** Only the session's own therapist or a doctor may edit a session. */
  assertCanEditSession(user: AuthUser, session: { therapistId: string }) {
    if (user.role === Role.DOCTOR) return;
    if (user.role === Role.THERAPIST && session.therapistId === user.id) return;
    throw new ForbiddenException('Only the assigned therapist or a doctor can edit this session');
  }

  async assertStaff(user: AuthUser, userId: string, roles: Role[]) {
    const staff = await this.prisma.user.findFirst({
      where: { id: userId, clinicId: user.clinicId, isActive: true, role: { in: roles } },
      select: { id: true, fullName: true, role: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
}
