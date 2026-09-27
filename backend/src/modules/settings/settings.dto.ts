import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { IsOptionalNonNull, TimezoneConstraint } from '../../common/validators';
import { SendingMode } from './setting.entity';

export class UpdateSettingsDto {
  @IsOptionalNonNull()
  @IsEnum(SendingMode)
  sendingMode?: SendingMode;

  @IsOptionalNonNull()
  @IsString()
  @MaxLength(200)
  organizerName?: string;

  @IsOptionalNonNull()
  @IsString()
  @MaxLength(200)
  senderName?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string | null;

  @IsOptionalNonNull()
  @Validate(TimezoneConstraint)
  timezone?: string;

  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(12)
  seasonStartMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  footerHtml?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  logoUrl?: string | null;

  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(60)
  ratePerMinute?: number;

  /** Google Workspace allows 2,000 messages/day; keep headroom for normal mail. */
  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(2000)
  dailyRecipientCap?: number;
}
