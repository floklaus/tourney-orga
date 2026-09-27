import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsOptionalNonNull, TIME_OF_DAY } from '../../common/validators';
import { MAX_SUBJECT } from '../template/template.dto';
import type { Anchor } from './domain/send-time';
import { TimingType } from './email-step.entity';

const MAX_OFFSET_DAYS = 730;

/** Timing and content shared by email steps and tournament email plan items. */
export class EmailStepFieldsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsUUID('4')
  templateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SUBJECT)
  subjectOverride?: string | null;

  @IsEnum(TimingType)
  timingType: TimingType;

  @ValidateIf(
    (dto: EmailStepFieldsDto) => dto.timingType === TimingType.ABSOLUTE,
  )
  @IsDateString()
  sendAt?: string | null;

  @ValidateIf(
    (dto: EmailStepFieldsDto) => dto.timingType === TimingType.RELATIVE,
  )
  @Type(() => Number)
  @IsInt()
  @Min(-MAX_OFFSET_DAYS)
  @Max(MAX_OFFSET_DAYS)
  offsetDays?: number | null;

  @ValidateIf(
    (dto: EmailStepFieldsDto) => dto.timingType === TimingType.RELATIVE,
  )
  @Matches(TIME_OF_DAY, { message: 'timeOfDay must be HH:mm' })
  timeOfDay?: string | null;

  @IsOptionalNonNull()
  @IsIn(['START', 'END'])
  anchor?: Anchor;
}

export class EmailPlanItemDto extends EmailStepFieldsDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  /** Read-only response field; accepted so clients can send items back as received. */
  @IsOptional()
  @IsString()
  templateName?: string | null;
}

export class UpdateEmailStepDto {
  @Type(() => Number)
  @IsInt()
  version: number;

  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptionalNonNull()
  @IsUUID('4')
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SUBJECT)
  subjectOverride?: string | null;

  @IsOptionalNonNull()
  @IsEnum(TimingType)
  timingType?: TimingType;

  @IsOptional()
  @IsDateString()
  sendAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-MAX_OFFSET_DAYS)
  @Max(MAX_OFFSET_DAYS)
  offsetDays?: number | null;

  @IsOptional()
  @Matches(TIME_OF_DAY, { message: 'timeOfDay must be HH:mm' })
  timeOfDay?: string | null;

  @IsOptionalNonNull()
  @IsIn(['START', 'END'])
  anchor?: Anchor;
}

export const STEP_ACTIONS = [
  'send-now',
  'skip',
  'pause',
  'resume',
  'cancel',
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export class BulkStepActionDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsIn(STEP_ACTIONS)
  action: StepAction;
}
