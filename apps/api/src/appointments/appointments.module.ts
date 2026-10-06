import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AppointmentStatus, AuditAction, Prisma, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles, STAFF_ROLES } from '../common/decorators';
import { publicUserSelect } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);
const MAX_RANGE_DAYS = 62;
const MAX_DURATION = 240;

class ListAppointmentsQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() therapistId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() patientId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

class CreateAppointmentDto {
  @IsString() patientId: string;
  @IsString() therapistId: string;
  /** Date and start time as an ISO timestamp. */
  @IsDateString() startAt: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(MAX_DURATION) durationMinutes?: number;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  /** Save even if the therapist has overlapping appointments (after the user saw the warning). */
  @IsOptional() @IsBoolean() force?: boolean;
}

class UpdateAppointmentDto {
  @IsOptional() @IsString() therapistId?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(MAX_DURATION) durationMinutes?: number;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

const include = {
  patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
  therapist: { select: publicUserSelect },
  session: { select: { id: true, status: true } },
} as const;

const BLOCKING: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: ListAppointmentsQuery) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (to <= from) throw new BadRequestException('"to" must be after "from"');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400000) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }
    return this.prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startAt: { gte: from, lt: to },
        therapistId: q.therapistId,
        patientId: q.patientId,
        status: q.status,
      },
      orderBy: { startAt: 'asc' },
      include,
    });
  }

  /** Appointments of the therapist that overlap [startAt, startAt + duration). */
  async findConflicts(clinicId: string, therapistId: string, startAt: Date, durationMinutes: number, excludeId?: string) {
    const end = new Date(startAt.getTime() + durationMinutes * 60000);
    const candidates = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        therapistId,
        status: { in: BLOCKING },
        id: excludeId ? { not: excludeId } : undefined,
        startAt: { gte: new Date(startAt.getTime() - MAX_DURATION * 60000), lt: end },
      },
      include,
    });
    return candidates.filter((a) => a.startAt.getTime() + a.durationMinutes * 60000 > startAt.getTime());
  }

  async create(user: AuthUser, dto: CreateAppointmentDto) {
    await this.access.assertPatient(user, dto.patientId);
    await this.access.assertStaff(user, dto.therapistId, [Role.THERAPIST, Role.DOCTOR]);
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId } });
    const startAt = new Date(dto.startAt);
    const durationMinutes = dto.durationMinutes ?? clinic.defaultAppointmentMinutes;

    const conflicts = await this.findConflicts(user.clinicId, dto.therapistId, startAt, durationMinutes);
    if (conflicts.length && !dto.force) throw this.conflictError(conflicts);

    const appt = await this.prisma.appointment.create({
      data: {
        clinicId: user.clinicId,
        patientId: dto.patientId,
        therapistId: dto.therapistId,
        startAt,
        durationMinutes,
        status: dto.status,
        notes: dto.notes,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include,
    });
    await this.audit.log(user, AuditAction.CREATE, 'Appointment', appt.id, {
      patientId: dto.patientId,
      overlapping: conflicts.length,
    });
    return { ...appt, conflicts: conflicts.map((c) => c.id) };
  }

  async update(user: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.prisma.appointment.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (dto.therapistId) await this.access.assertStaff(user, dto.therapistId, [Role.THERAPIST, Role.DOCTOR]);

    const therapistId = dto.therapistId ?? existing.therapistId;
    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const durationMinutes = dto.durationMinutes ?? existing.durationMinutes;
    const status = dto.status ?? existing.status;
    const timingChanged = dto.therapistId || dto.startAt || dto.durationMinutes;

    let conflicts: Awaited<ReturnType<AppointmentsService['findConflicts']>> = [];
    if (timingChanged && BLOCKING.includes(status)) {
      conflicts = await this.findConflicts(user.clinicId, therapistId, startAt, durationMinutes, id);
      if (conflicts.length && !dto.force) throw this.conflictError(conflicts);
    }

    const { force: _force, ...data } = dto;
    const appt = await this.prisma.appointment.update({
      where: { id },
      data: { ...data, startAt: dto.startAt ? startAt : undefined, updatedBy: user.id },
      include,
    });
    await this.audit.log(user, AuditAction.UPDATE, 'Appointment', id, { fields: Object.keys(data), status: dto.status });
    return { ...appt, conflicts: conflicts.map((c) => c.id) };
  }

  private conflictError(conflicts: Prisma.AppointmentGetPayload<{ include: typeof include }>[]) {
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'THERAPIST_OVERLAP',
      message: 'The therapist already has an overlapping appointment',
      conflicts: conflicts.map((c) => ({
        id: c.id,
        startAt: c.startAt,
        durationMinutes: c.durationMinutes,
        patient: c.patient,
      })),
    });
  }
}

const SCHEDULERS = [Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST];

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  list(@CurrentUser() user: AuthUser, @Query() q: ListAppointmentsQuery) {
    return this.appointments.list(user, q);
  }

  @Post()
  @Roles(...SCHEDULERS)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(user, dto);
  }

  @Patch(':id')
  @Roles(...SCHEDULERS)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(user, id, dto);
  }
}

@Module({ controllers: [AppointmentsController], providers: [AppointmentsService] })
export class AppointmentsModule {}
