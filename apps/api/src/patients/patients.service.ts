import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  AuditAction,
  PatientStatus,
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
import { ageInYears, toDateOnly } from '../common/time';
import { publicUserSelect } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePatientDto,
  DiagnosisDto,
  GuardianDto,
  ListPatientsQuery,
  UpdateDiagnosisDto,
  UpdateGuardianDto,
  UpdatePatientDto,
} from './patients.dto';

const UPCOMING: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: ListPatientsQuery) {
    const and: Prisma.PatientWhereInput[] = [this.access.patientScope(user)];
    if (q.search) {
      for (const term of q.search.split(/\s+/).filter(Boolean)) {
        and.push({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { patientCode: { contains: term, mode: 'insensitive' } },
          ],
        });
      }
    }
    if (q.status) and.push({ status: q.status });
    if (q.therapistId) and.push({ primaryTherapistId: q.therapistId });
    if (q.diagnosis) and.push({ diagnoses: { some: { name: { contains: q.diagnosis, mode: 'insensitive' } } } });
    const where: Prisma.PatientWhereInput = { AND: and };

    const now = new Date();
    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          primaryTherapist: { select: publicUserSelect },
          diagnoses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], take: 1 },
          therapySessions: {
            where: { status: SessionStatus.COMPLETED },
            orderBy: { sessionDate: 'desc' },
            take: 1,
            select: { id: true, sessionDate: true },
          },
          appointments: {
            where: { status: { in: UPCOMING }, startAt: { gte: now } },
            orderBy: { startAt: 'asc' },
            take: 1,
            select: { id: true, startAt: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const data = rows.map((p) => ({
      id: p.id,
      patientCode: p.patientCode,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      age: ageInYears(p.dateOfBirth, now),
      gender: p.gender,
      status: p.status,
      diagnosis: p.diagnoses[0]?.name ?? null,
      therapist: p.primaryTherapist,
      lastSession: p.therapySessions[0] ?? null,
      nextAppointment: p.appointments[0] ?? null,
    }));
    return paginated(data, total, q.page, q.pageSize);
  }

  async create(user: AuthUser, dto: CreatePatientDto) {
    if (dto.primaryTherapistId) await this.access.assertStaff(user, dto.primaryTherapistId, [Role.THERAPIST, Role.DOCTOR]);
    const dob = toDateOnly(dto.dateOfBirth);
    if (dob > new Date()) throw new ConflictException('Date of birth cannot be in the future');

    const guardians = normalisePrimary(dto.guardians);
    const patient = await this.prisma.$transaction(async (tx) => {
      const patientCode = dto.patientCode ?? (await this.nextPatientCode(tx, user.clinicId));
      const clash = await tx.patient.findUnique({
        where: { clinicId_patientCode: { clinicId: user.clinicId, patientCode } },
      });
      if (clash) throw new ConflictException(`Patient code ${patientCode} is already in use`);

      const created = await tx.patient.create({
        data: {
          clinicId: user.clinicId,
          patientCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dob,
          gender: dto.gender,
          medicalNotes: dto.medicalNotes,
          primaryTherapistId: dto.primaryTherapistId,
          createdBy: user.id,
          updatedBy: user.id,
          guardians: { create: guardians },
          diagnoses: dto.diagnosis
            ? { create: { name: dto.diagnosis, isPrimary: true, createdBy: user.id, updatedBy: user.id } }
            : undefined,
        },
      });
      await this.audit.log(user, AuditAction.CREATE, 'Patient', created.id, { patientCode }, tx);
      return created;
    });
    return this.findOne(user, patient.id);
  }

  async findOne(user: AuthUser, id: string) {
    await this.access.assertPatient(user, id);
    const now = new Date();
    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: {
        primaryTherapist: { select: publicUserSelect },
        guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        diagnoses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        appointments: {
          where: { status: { in: UPCOMING }, startAt: { gte: now } },
          orderBy: { startAt: 'asc' },
          take: 1,
          include: { therapist: { select: publicUserSelect } },
        },
      },
    });
    const { appointments, ...rest } = patient;
    const base = { ...rest, age: ageInYears(patient.dateOfBirth, now), nextAppointment: appointments[0] ?? null };

    // Receptionists manage demographics only; clinical data is not returned to them.
    if (user.role === Role.RECEPTIONIST) {
      return { ...base, medicalNotes: undefined, activePlan: null, recentSessions: [], latestAssessment: null, clinicalAccess: false };
    }

    const [activePlan, recentSessions, latestAssessment, clinic] = await Promise.all([
      this.prisma.treatmentPlan.findFirst({
        where: { patientId: id, status: TreatmentPlanStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
        include: { goals: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.therapySession.findMany({
        where: { patientId: id },
        orderBy: { sessionDate: 'desc' },
        take: 5,
        include: {
          therapist: { select: publicUserSelect },
          _count: { select: { exercises: true, measurements: true } },
        },
      }),
      this.prisma.assessment.findFirst({
        where: { patientId: id },
        orderBy: { assessedAt: 'desc' },
        select: { id: true, type: true, assessedAt: true, author: { select: publicUserSelect } },
      }),
      this.prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId } }),
    ]);

    const reassessDue = latestAssessment
      ? latestAssessment.assessedAt.getTime() + clinic.reassessmentIntervalDays * 86400000 < now.getTime()
      : true;
    const reviewDue = activePlan?.reviewDate ? activePlan.reviewDate <= now : false;

    return {
      ...base,
      activePlan: activePlan ? { ...activePlan, goals: activePlan.goals.map(withProgress) } : null,
      recentSessions,
      latestAssessment,
      needsReassessment: patient.status === PatientStatus.ACTIVE && (reassessDue || reviewDue),
      clinicalAccess: true,
    };
  }

  async update(user: AuthUser, id: string, dto: UpdatePatientDto) {
    await this.access.assertPatient(user, id);
    if (user.role === Role.RECEPTIONIST && (dto.status !== undefined || dto.medicalNotes !== undefined)) {
      throw new ForbiddenException('Receptionists can only update demographic information');
    }
    if (dto.primaryTherapistId) await this.access.assertStaff(user, dto.primaryTherapistId, [Role.THERAPIST, Role.DOCTOR]);
    if (dto.patientCode) {
      const clash = await this.prisma.patient.findFirst({
        where: { clinicId: user.clinicId, patientCode: dto.patientCode, NOT: { id } },
      });
      if (clash) throw new ConflictException(`Patient code ${dto.patientCode} is already in use`);
    }
    await this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? toDateOnly(dto.dateOfBirth) : undefined,
        updatedBy: user.id,
      },
    });
    await this.audit.log(user, AuditAction.UPDATE, 'Patient', id, { fields: Object.keys(dto) });
    return this.findOne(user, id);
  }

  // ---- Guardians -----------------------------------------------------------

  async addGuardian(user: AuthUser, patientId: string, dto: GuardianDto) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) await tx.guardian.updateMany({ where: { patientId }, data: { isPrimary: false } });
      const g = await tx.guardian.create({ data: { ...dto, patientId } });
      await this.audit.log(user, AuditAction.CREATE, 'Guardian', g.id, { patientId }, tx);
      return g;
    });
  }

  async updateGuardian(user: AuthUser, id: string, dto: UpdateGuardianDto) {
    const g = await this.findGuardian(user, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) await tx.guardian.updateMany({ where: { patientId: g.patientId }, data: { isPrimary: false } });
      const updated = await tx.guardian.update({ where: { id }, data: dto });
      await this.audit.log(user, AuditAction.UPDATE, 'Guardian', id, { fields: Object.keys(dto) }, tx);
      return updated;
    });
  }

  async removeGuardian(user: AuthUser, id: string) {
    const g = await this.findGuardian(user, id);
    const count = await this.prisma.guardian.count({ where: { patientId: g.patientId } });
    if (count <= 1) throw new ConflictException('A patient must have at least one guardian');
    await this.prisma.guardian.delete({ where: { id } });
    await this.audit.log(user, AuditAction.DELETE, 'Guardian', id, { patientId: g.patientId });
  }

  private async findGuardian(user: AuthUser, id: string) {
    const g = await this.prisma.guardian.findFirst({ where: { id, patient: this.access.patientScope(user) } });
    if (!g) throw new NotFoundException('Guardian not found');
    return g;
  }

  // ---- Diagnoses -----------------------------------------------------------

  async addDiagnosis(user: AuthUser, patientId: string, dto: DiagnosisDto) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary !== false) await tx.diagnosis.updateMany({ where: { patientId }, data: { isPrimary: false } });
      const d = await tx.diagnosis.create({
        data: {
          ...dto,
          isPrimary: dto.isPrimary ?? true,
          diagnosedAt: dto.diagnosedAt ? toDateOnly(dto.diagnosedAt) : undefined,
          patientId,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.audit.log(user, AuditAction.CREATE, 'Diagnosis', d.id, { patientId }, tx);
      return d;
    });
  }

  async updateDiagnosis(user: AuthUser, id: string, dto: UpdateDiagnosisDto) {
    const d = await this.findDiagnosis(user, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) await tx.diagnosis.updateMany({ where: { patientId: d.patientId }, data: { isPrimary: false } });
      const updated = await tx.diagnosis.update({
        where: { id },
        data: {
          ...dto,
          diagnosedAt: dto.diagnosedAt ? toDateOnly(dto.diagnosedAt) : undefined,
          updatedBy: user.id,
        },
      });
      await this.audit.log(user, AuditAction.UPDATE, 'Diagnosis', id, { fields: Object.keys(dto) }, tx);
      return updated;
    });
  }

  async removeDiagnosis(user: AuthUser, id: string) {
    const d = await this.findDiagnosis(user, id);
    await this.prisma.diagnosis.delete({ where: { id } });
    await this.audit.log(user, AuditAction.DELETE, 'Diagnosis', id, { patientId: d.patientId, name: d.name });
  }

  private async findDiagnosis(user: AuthUser, id: string) {
    const d = await this.prisma.diagnosis.findFirst({ where: { id, patient: this.access.patientScope(user) } });
    if (!d) throw new NotFoundException('Diagnosis not found');
    return d;
  }

  /** Generates the next sequential code (KR-0001, KR-0002, …) for a clinic. */
  private async nextPatientCode(tx: Prisma.TransactionClient, clinicId: string) {
    const count = await tx.patient.count({ where: { clinicId } });
    for (let n = count + 1; ; n++) {
      const code = `KR-${String(n).padStart(4, '0')}`;
      const taken = await tx.patient.findUnique({ where: { clinicId_patientCode: { clinicId, patientCode: code } } });
      if (!taken) return code;
    }
  }
}

/** Ensures exactly one guardian is primary (the first flagged one, or the first in the list). */
function normalisePrimary(guardians: GuardianDto[]) {
  const primaryIndex = Math.max(0, guardians.findIndex((g) => g.isPrimary));
  return guardians.map((g, i) => ({ ...g, isPrimary: i === primaryIndex }));
}
