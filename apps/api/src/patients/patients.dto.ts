import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Gender, PatientStatus } from '@prisma/client';
import { PaginationQuery } from '../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;

export const RELATIONSHIPS = ['Mother', 'Father', 'Grandparent', 'Guardian', 'Other'] as const;
const PHONE = /^[+0-9][0-9 .\-()]{6,19}$/;

export class GuardianDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) fullName: string;
  @IsIn(RELATIONSHIPS as unknown as string[]) relationship: string;
  @Transform(trim) @Matches(PHONE, { message: 'phone must be a valid phone number' }) phone: string;
  @Transform(emptyToUndefined) @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateGuardianDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) fullName?: string;
  @IsOptional() @IsIn(RELATIONSHIPS as unknown as string[]) relationship?: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'phone must be a valid phone number' }) phone?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreatePatientDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) firstName: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) lastName: string;
  @IsDateString({ strict: true }) dateOfBirth: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(30) patientCode?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(5000) medicalNotes?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() primaryTherapistId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(200) diagnosis?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one guardian is required' })
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians: GuardianDto[];
}

export class UpdatePatientDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) lastName?: string;
  @IsOptional() @IsDateString({ strict: true }) dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(30) patientCode?: string;
  @IsOptional() @IsEnum(PatientStatus) status?: PatientStatus;
  @IsOptional() @IsString() @MaxLength(5000) medicalNotes?: string;
  /** null unassigns the primary therapist. */
  @IsOptional() @IsString() primaryTherapistId?: string | null;
}

export class ListPatientsQuery extends PaginationQuery {
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(100) search?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsEnum(PatientStatus) status?: PatientStatus;
  @Transform(emptyToUndefined) @IsOptional() @IsString() therapistId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(100) diagnosis?: string;
}

export class DiagnosisDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(20) icdCode?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @Transform(emptyToUndefined) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() diagnosedAt?: string;
}

export class UpdateDiagnosisDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(20) icdCode?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsDateString() diagnosedAt?: string;
}
