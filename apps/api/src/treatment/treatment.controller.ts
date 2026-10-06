import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { CLINICAL_ROLES, CurrentUser, Roles } from '../common/decorators';
import { CreateGoalDto, CreateTreatmentPlanDto, UpdateGoalDto, UpdateTreatmentPlanDto } from './treatment.dto';
import { TreatmentService } from './treatment.service';

/** Treatment plans and goals: doctors create/edit; therapists and admins can view. */
@Controller()
export class TreatmentController {
  constructor(private readonly treatment: TreatmentService) {}

  @Get('patients/:id/treatment-plans')
  @Roles(...CLINICAL_ROLES)
  listPlans(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.treatment.listPlans(user, id);
  }

  @Post('patients/:id/treatment-plans')
  @Roles(Role.DOCTOR)
  createPlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateTreatmentPlanDto) {
    return this.treatment.createPlan(user, id, dto);
  }

  @Patch('treatment-plans/:id')
  @Roles(Role.DOCTOR)
  updatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTreatmentPlanDto) {
    return this.treatment.updatePlan(user, id, dto);
  }

  @Post('treatment-plans/:id/goals')
  @Roles(Role.DOCTOR)
  createGoal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateGoalDto) {
    return this.treatment.createGoal(user, id, dto);
  }

  @Patch('goals/:id')
  @Roles(Role.DOCTOR)
  updateGoal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.treatment.updateGoal(user, id, dto);
  }
}
