import { Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const STAFF: Role[] = [Role.ADMIN, Role.DOCTOR, Role.THERAPIST, Role.RECEPTIONIST];

class ListUsersQuery {
  @IsOptional() @IsIn(STAFF) role?: Role;
}

class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsString() @IsNotEmpty() @MaxLength(120) fullName: string;
  @IsIn(STAFF) role: Role;
  @IsString() @MinLength(8) @MaxLength(200) password: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) fullName?: string;
  @IsOptional() @IsIn(STAFF) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(200) password?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

class UpdateClinicDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(240) defaultAppointmentMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(730) reassessmentIntervalDays?: number;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
} as const;

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Staff directory for pickers (e.g. therapist selection). Available to all staff. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListUsersQuery) {
    return this.prisma.user.findMany({
      where: {
        clinicId: user.clinicId,
        role: q.role ?? { in: STAFF },
        ...(user.role === Role.ADMIN ? {} : { isActive: true }),
      },
      select: userSelect,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('A user with this email already exists');
    const created = await this.prisma.user.create({
      data: {
        clinicId: user.clinicId,
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select: userSelect,
    });
    await this.audit.log(user, AuditAction.CREATE, 'User', created.id, { role: created.role });
    return created;
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!target) throw new NotFoundException('User not found');
    const { password, ...rest } = dto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      select: userSelect,
    });
    if (dto.isActive === false || password) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log(user, AuditAction.UPDATE, 'User', id, { fields: Object.keys(dto) });
    return updated;
  }
}

@Controller('clinic')
export class ClinicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId } });
  }

  @Patch()
  @Roles(Role.ADMIN)
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateClinicDto) {
    const clinic = await this.prisma.clinic.update({ where: { id: user.clinicId }, data: dto });
    await this.audit.log(user, AuditAction.UPDATE, 'Clinic', clinic.id, { fields: Object.keys(dto) });
    return clinic;
  }
}
