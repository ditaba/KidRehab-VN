import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CLINICAL_ROLES, CurrentUser, Roles } from '../common/decorators';
import {
  AddSessionExerciseDto,
  CreateSessionDto,
  ListSessionsQuery,
  RecordMeasurementDto,
  UpdateSessionDto,
  UpdateSessionExerciseDto,
} from './sessions.dto';
import { SessionsService } from './sessions.service';

const SESSION_WRITERS = [Role.THERAPIST, Role.DOCTOR];

class TodayQuery {
  @IsOptional() @IsString() therapistId?: string;
}

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('sessions/today')
  @Roles(...CLINICAL_ROLES)
  today(@CurrentUser() user: AuthUser, @Query() q: TodayQuery) {
    return this.sessions.today(user, q.therapistId);
  }

  @Get('sessions')
  @Roles(...CLINICAL_ROLES)
  list(@CurrentUser() user: AuthUser, @Query() q: ListSessionsQuery) {
    return this.sessions.list(user, q);
  }

  @Get('patients/:id/sessions')
  @Roles(...CLINICAL_ROLES)
  listForPatient(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: ListSessionsQuery) {
    return this.sessions.listForPatient(user, id, q);
  }

  @Post('patients/:id/sessions')
  @Roles(...SESSION_WRITERS)
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user, id, dto);
  }

  @Get('sessions/:id')
  @Roles(...CLINICAL_ROLES)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.findOne(user, id);
  }

  @Patch('sessions/:id')
  @Roles(...SESSION_WRITERS)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessions.update(user, id, dto);
  }

  @Post('sessions/:id/complete')
  @HttpCode(200)
  @Roles(...SESSION_WRITERS)
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessions.complete(user, id, dto);
  }

  @Post('sessions/:id/exercises')
  @Roles(...SESSION_WRITERS)
  addExercise(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddSessionExerciseDto) {
    return this.sessions.addExercise(user, id, dto);
  }

  @Patch('sessions/:id/exercises/:seId')
  @Roles(...SESSION_WRITERS)
  updateExercise(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('seId') seId: string,
    @Body() dto: UpdateSessionExerciseDto,
  ) {
    return this.sessions.updateExercise(user, id, seId, dto);
  }

  @Delete('sessions/:id/exercises/:seId')
  @HttpCode(204)
  @Roles(...SESSION_WRITERS)
  removeExercise(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('seId') seId: string) {
    return this.sessions.removeExercise(user, id, seId);
  }

  @Post('sessions/:id/measurements')
  @Roles(...SESSION_WRITERS)
  recordMeasurement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordMeasurementDto) {
    return this.sessions.recordMeasurement(user, id, dto);
  }

  @Delete('sessions/:id/measurements/:measurementId')
  @HttpCode(204)
  @Roles(...SESSION_WRITERS)
  removeMeasurement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('measurementId') measurementId: string,
  ) {
    return this.sessions.removeMeasurement(user, id, measurementId);
  }
}
