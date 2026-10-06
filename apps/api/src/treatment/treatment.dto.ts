import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GoalStatus, MetricDirection, TreatmentPlanStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

export class CreateTreatmentPlanDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(2000) primaryObjective?: string;
  @IsDateString() startDate: string;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() reviewDate?: string;
  @IsOptional() @IsString() @MaxLength(100) recommendedFrequency?: string;
  @IsOptional() @IsString() @MaxLength(100) expectedDuration?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsEnum(TreatmentPlanStatus) status?: TreatmentPlanStatus;
}

export class UpdateTreatmentPlanDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) primaryObjective?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() reviewDate?: string;
  @IsOptional() @IsString() @MaxLength(100) recommendedFrequency?: string;
  @IsOptional() @IsString() @MaxLength(100) expectedDuration?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsEnum(TreatmentPlanStatus) status?: TreatmentPlanStatus;
}

export class CreateGoalDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  /** Defaults to the goal title when omitted. */
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) metricName?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(30) unit: string;
  @IsOptional() @IsEnum(MetricDirection) direction?: MetricDirection;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) baselineValue: number;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) targetValue: number;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsEnum(GoalStatus) status?: GoalStatus;
  /** Associate an existing metric of this patient (keeps its measurement history). */
  @Transform(emptyToUndefined) @IsOptional() @IsString() progressMetricId?: string;
}

export class UpdateGoalDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) metricName?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(30) unit?: string;
  @IsOptional() @IsEnum(MetricDirection) direction?: MetricDirection;
  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) baselineValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) targetValue?: number;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsEnum(GoalStatus) status?: GoalStatus;
}
