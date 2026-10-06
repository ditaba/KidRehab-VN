import { Body, Controller, Get, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditAction, ExerciseCategory, ExerciseStatus, Prisma, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { CLINICAL_ROLES, CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

class ListExercisesQuery {
  @Transform(emptyToUndefined) @IsOptional() @IsEnum(ExerciseStatus) status?: ExerciseStatus;
  @Transform(emptyToUndefined) @IsOptional() @IsEnum(ExerciseCategory) category?: ExerciseCategory;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

class CreateExerciseDto {
  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Exercise name is required' }) @MaxLength(150) name: string;
  @IsOptional() @IsEnum(ExerciseCategory) category?: ExerciseCategory;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(5000) instructions?: string;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) defaultSets?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) defaultRepetitions?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(7200) defaultDurationSeconds?: number | null;
  @IsOptional() @IsEnum(ExerciseStatus) status?: ExerciseStatus;
}

class UpdateExerciseDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty({ message: 'Exercise name is required' }) @MaxLength(150) name?: string;
  @IsOptional() @IsEnum(ExerciseCategory) category?: ExerciseCategory;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(5000) instructions?: string;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) defaultSets?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) defaultRepetitions?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(7200) defaultDurationSeconds?: number | null;
  /** Disabling hides an exercise from new sessions without touching historical session data. */
  @IsOptional() @IsEnum(ExerciseStatus) status?: ExerciseStatus;
}

@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(...CLINICAL_ROLES)
  list(@CurrentUser() user: AuthUser, @Query() q: ListExercisesQuery) {
    const where: Prisma.ExerciseWhereInput = {
      clinicId: user.clinicId,
      status: q.status,
      category: q.category,
      name: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    return this.prisma.exercise.findMany({
      where,
      orderBy: [{ status: 'asc' }, { category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { sessionExercises: true } } },
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateExerciseDto) {
    const ex = await this.prisma.exercise.create({
      data: { ...dto, clinicId: user.clinicId, createdBy: user.id, updatedBy: user.id },
    });
    await this.audit.log(user, AuditAction.CREATE, 'Exercise', ex.id, { name: ex.name });
    return ex;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    const existing = await this.prisma.exercise.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!existing) throw new NotFoundException('Exercise not found');
    const ex = await this.prisma.exercise.update({ where: { id }, data: { ...dto, updatedBy: user.id } });
    await this.audit.log(user, AuditAction.UPDATE, 'Exercise', id, { fields: Object.keys(dto), status: dto.status });
    return ex;
  }
}

@Module({ controllers: [ExercisesController] })
export class ExercisesModule {}
