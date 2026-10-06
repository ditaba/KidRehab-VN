import { applyDecorators, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { AssessmentType, AuditAction, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user';
import { CLINICAL_ROLES, CurrentUser, Roles } from '../common/decorators';
import { publicUserSelect } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

const text = () => applyDecorators(IsOptional(), IsString(), MaxLength(10000));

export class AssessmentDto {
  @IsOptional() @IsEnum(AssessmentType) type?: AssessmentType;
  @IsOptional() @IsDateString() assessedAt?: string;
  @text() medicalHistory?: string;
  @text() developmentHistory?: string;
  @text() functionalAbility?: string;
  @text() rangeOfMotion?: string;
  @text() strength?: string;
  @text() balance?: string;
  @text() gait?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;
  @text() pain?: string;
  @text() clinicalNotes?: string;
}

const include = { author: { select: publicUserSelect } } as const;

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.assessment.findMany({ where: { patientId }, orderBy: { assessedAt: 'desc' }, include });
  }

  async create(user: AuthUser, patientId: string, dto: AssessmentDto) {
    await this.access.assertPatient(user, patientId);
    const existing = await this.prisma.assessment.count({ where: { patientId } });
    const a = await this.prisma.assessment.create({
      data: {
        ...dto,
        type: dto.type ?? (existing === 0 ? AssessmentType.INITIAL : AssessmentType.REASSESSMENT),
        assessedAt: dto.assessedAt ? new Date(dto.assessedAt) : undefined,
        patientId,
        authorId: user.id,
        updatedBy: user.id,
      },
      include,
    });
    await this.audit.log(user, AuditAction.CREATE, 'Assessment', a.id, { patientId });
    return a;
  }

  async findOne(user: AuthUser, id: string) {
    const a = await this.prisma.assessment.findFirst({
      where: { id, patient: this.access.patientScope(user) },
      include,
    });
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  async update(user: AuthUser, id: string, dto: AssessmentDto) {
    await this.findOne(user, id);
    const a = await this.prisma.assessment.update({
      where: { id },
      data: { ...dto, assessedAt: dto.assessedAt ? new Date(dto.assessedAt) : undefined, updatedBy: user.id },
      include,
    });
    await this.audit.log(user, AuditAction.UPDATE, 'Assessment', id, { fields: Object.keys(dto) });
    return a;
  }
}

/** Assessments: doctors create/edit; therapists and admins can view; receptionists have no access. */
@Controller()
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('patients/:id/assessments')
  @Roles(...CLINICAL_ROLES)
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.list(user, id);
  }

  @Post('patients/:id/assessments')
  @Roles(Role.DOCTOR)
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssessmentDto) {
    return this.assessments.create(user, id, dto);
  }

  @Get('assessments/:id')
  @Roles(...CLINICAL_ROLES)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.findOne(user, id);
  }

  @Patch('assessments/:id')
  @Roles(Role.DOCTOR)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssessmentDto) {
    return this.assessments.update(user, id, dto);
  }
}

@Module({ controllers: [AssessmentsController], providers: [AssessmentsService] })
export class AssessmentsModule {}
