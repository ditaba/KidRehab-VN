import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AssistanceLevel, Mood, SessionStatus, Tolerance } from '@prisma/client';
import { PaginationQuery } from '../common/pagination';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

export class CreateSessionDto {
  @Transform(emptyToUndefined) @IsOptional() @IsString() appointmentId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() therapistId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() sessionDate?: string;
}

/** All observation fields accept null to clear a previously entered value. */
export class UpdateSessionDto {
  @IsOptional() @IsDateString() sessionDate?: string;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(480) durationMinutes?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) painScore?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) energyLevel?: number | null;
  @Transform(emptyToNull) @IsOptional() @IsEnum(Mood) mood?: Mood | null;
  @Transform(emptyToNull) @IsOptional() @IsEnum(Tolerance) tolerance?: Tolerance | null;
  @Transform(emptyToNull) @IsOptional() @IsEnum(AssistanceLevel) assistanceLevel?: AssistanceLevel | null;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string | null;
  /** Only DRAFT → CANCELLED is allowed here; use POST /sessions/:id/complete to complete. */
  @IsOptional() @IsIn([SessionStatus.CANCELLED]) status?: SessionStatus;
}

export class AddSessionExerciseDto {
  @IsString() exerciseId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) sets?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) repetitions?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(7200) durationSeconds?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateSessionExerciseDto {
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) sets?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) repetitions?: number | null;
  @Transform(emptyToNull) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(7200) durationSeconds?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class RecordMeasurementDto {
  @IsString() progressMetricId: string;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) value: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ListSessionsQuery extends PaginationQuery {
  @Transform(emptyToUndefined) @IsOptional() @IsEnum(SessionStatus) status?: SessionStatus;
  @Transform(emptyToUndefined) @IsOptional() @IsString() therapistId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() patientId?: string;
}
