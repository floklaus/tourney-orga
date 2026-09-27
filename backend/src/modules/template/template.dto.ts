import { IsOptionalNonNull } from '../../common/validators';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const MAX_SUBJECT = 300;
export const MAX_BODY = 200_000;

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SUBJECT)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY)
  bodyHtml: string;
}

export class UpdateTemplateDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SUBJECT)
  subject?: string;

  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY)
  bodyHtml?: string;
}

export class PreviewDto {
  @IsString()
  @MaxLength(MAX_SUBJECT)
  subject: string;

  @IsString()
  @MaxLength(MAX_BODY)
  bodyHtml: string;

  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @IsOptional()
  @IsUUID('4')
  tournamentId?: string;

  @IsOptional()
  @IsUUID('4')
  participationId?: string;
}
