import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles, STAFF_ROLES } from '../common/decorators';
import {
  CreatePatientDto,
  DiagnosisDto,
  GuardianDto,
  ListPatientsQuery,
  UpdateDiagnosisDto,
  UpdateGuardianDto,
  UpdatePatientDto,
} from './patients.dto';
import { PatientsService } from './patients.service';

const DEMOGRAPHIC_EDITORS = [Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST];

@Controller()
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get('patients')
  @Roles(...STAFF_ROLES)
  list(@CurrentUser() user: AuthUser, @Query() q: ListPatientsQuery) {
    return this.patients.list(user, q);
  }

  @Post('patients')
  @Roles(...DEMOGRAPHIC_EDITORS)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patients.create(user, dto);
  }

  @Get('patients/:id')
  @Roles(...STAFF_ROLES)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.findOne(user, id);
  }

  @Patch('patients/:id')
  @Roles(...DEMOGRAPHIC_EDITORS)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(user, id, dto);
  }

  // Guardians
  @Post('patients/:id/guardians')
  @Roles(...DEMOGRAPHIC_EDITORS)
  addGuardian(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GuardianDto) {
    return this.patients.addGuardian(user, id, dto);
  }

  @Patch('guardians/:id')
  @Roles(...DEMOGRAPHIC_EDITORS)
  updateGuardian(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    return this.patients.updateGuardian(user, id, dto);
  }

  @Delete('guardians/:id')
  @HttpCode(204)
  @Roles(...DEMOGRAPHIC_EDITORS)
  removeGuardian(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.removeGuardian(user, id);
  }

  // Diagnoses (clinical)
  @Post('patients/:id/diagnoses')
  @Roles(Role.ADMIN, Role.DOCTOR)
  addDiagnosis(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DiagnosisDto) {
    return this.patients.addDiagnosis(user, id, dto);
  }

  @Patch('diagnoses/:id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  updateDiagnosis(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDiagnosisDto) {
    return this.patients.updateDiagnosis(user, id, dto);
  }

  @Delete('diagnoses/:id')
  @HttpCode(204)
  @Roles(Role.ADMIN, Role.DOCTOR)
  removeDiagnosis(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.removeDiagnosis(user, id);
  }
}
