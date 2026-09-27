import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const MIN_PASSWORD_LENGTH = 12;

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class InviteUserDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;
}

export class UpdateUserDto {
  @IsBoolean()
  isActive: boolean;
}

export class AcceptInvitationDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  password: string;
}
