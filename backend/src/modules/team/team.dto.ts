import { IsOptionalNonNull } from '../../common/validators';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from '../user/user.dto';

export const MAX_CC_EMAILS = 5;
export const MIN_GRADUATION_YEAR = 2000;
export const MAX_GRADUATION_YEAR = 2100;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmails = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v) =>
        typeof v === 'string' ? v.trim().toLowerCase() : v,
      )
    : value;

export class CreateTeamDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contactName: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsOptionalNonNull()
  @Transform(normalizeEmails)
  @ArrayMaxSize(MAX_CC_EMAILS)
  @IsEmail({}, { each: true })
  ccEmails?: string[];

  @IsOptional()
  @IsInt()
  @Min(MIN_GRADUATION_YEAR)
  @Max(MAX_GRADUATION_YEAR)
  graduationYear?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptionalNonNull()
  @IsUUID('4', { each: true })
  groupIds?: string[];
}

export class UpdateTeamDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contactName?: string;

  @IsOptionalNonNull()
  @Transform(normalizeEmail)
  @IsEmail()
  email?: string;

  @IsOptionalNonNull()
  @Transform(normalizeEmails)
  @ArrayMaxSize(MAX_CC_EMAILS)
  @IsEmail({}, { each: true })
  ccEmails?: string[];

  @IsOptional()
  @IsInt()
  @Min(MIN_GRADUATION_YEAR)
  @Max(MAX_GRADUATION_YEAR)
  graduationYear?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptionalNonNull()
  @IsUUID('4', { each: true })
  groupIds?: string[];

  @IsOptionalNonNull()
  @IsBoolean()
  isArchived?: boolean;
}

export class ImportTeamsDto {
  @IsString()
  @MaxLength(2_000_000)
  csv: string;

  @IsIn(['create', 'upsert'])
  mode: 'create' | 'upsert';

  @Type(() => Boolean)
  @IsBoolean()
  dryRun: boolean;
}

export class CreateGroupDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateGroupDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
