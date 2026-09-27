import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsObject,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsOptionalNonNull } from '../../common/validators';
import { EmailPlanItemDto } from '../email/email-step.dto';
import { ParticipationStatus } from './domain/participation-process';
import { MAX_TOURNAMENT_DAYS } from './domain/tournament-days';

const MAX_OFFSET_DAYS = 730;

export class MilestoneDto {
  @IsEnum(ParticipationStatus)
  status: ParticipationStatus;

  @Type(() => Number)
  @IsInt()
  @Min(-MAX_OFFSET_DAYS)
  @Max(MAX_OFFSET_DAYS)
  offsetDays: number;

  @IsIn(['START', 'END'])
  anchor: 'START' | 'END';

  /** Read-only fields of milestone responses; accepted so clients can send milestones back as received. */
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class CreateTournamentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url?: string | null;

  @IsDateString({ strict: true })
  startDate: string;

  @IsDateString({ strict: true })
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  ageGroups?: string[];

  @IsOptionalNonNull()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones?: MilestoneDto[];

  @IsOptionalNonNull()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EmailPlanItemDto)
  emailPlan?: EmailPlanItemDto[];
}

export class UpdateTournamentDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url?: string | null;

  @IsOptionalNonNull()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptionalNonNull()
  @IsDateString({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  ageGroups?: string[];

  @IsOptionalNonNull()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones?: MilestoneDto[];

  @IsOptionalNonNull()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EmailPlanItemDto)
  emailPlan?: EmailPlanItemDto[];
}

export class ParticipationDefaultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones: MilestoneDto[];
}

export class CreateParticipationDto {
  @IsUUID('4')
  tournamentId: string;

  @IsUUID('4')
  teamId: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ageGroup?: string | null;

  /** Tournament days the team plays on (YYYY-MM-DD); default: all days. */
  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(MAX_TOURNAMENT_DAYS)
  @IsDateString({ strict: true }, { each: true })
  days?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class BulkCreateParticipationDto {
  @IsUUID('4')
  tournamentId: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  teamIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ageGroup?: string | null;

  /** Tournament days the team plays on (YYYY-MM-DD); default: all days. */
  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(MAX_TOURNAMENT_DAYS)
  @IsDateString({ strict: true }, { each: true })
  days?: string[];
}

export class UpdateParticipationDto {
  @Type(() => Number)
  @IsInt()
  version: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ageGroup?: string | null;

  /** Tournament days the team plays on (YYYY-MM-DD); default: all days. */
  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(MAX_TOURNAMENT_DAYS)
  @IsDateString({ strict: true }, { each: true })
  days?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  /** Per-team overrides of tournament variables (blank = no override). */
  @IsOptionalNonNull()
  @IsObject()
  variables?: Record<string, string>;
}

export class TransitionDto {
  @IsEnum(ParticipationStatus)
  to: ParticipationStatus;

  @Type(() => Number)
  @IsInt()
  version: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class BulkTransitionDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(ParticipationStatus)
  to: ParticipationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class ForceQuery {
  @IsOptional()
  @IsIn(['true', 'false'])
  force?: 'true' | 'false';
}
