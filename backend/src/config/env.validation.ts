import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

/** NONE: no mailbox configured; the app only prepares emails for manual sending. */
export type MailAuthMode = 'OAUTH2' | 'APP_PASSWORD' | 'SMTP' | 'NONE';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  PORT = 3001;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  /** Public URL of the frontend (links in emails). */
  @IsUrl({ require_tld: false })
  APP_URL: string;

  /** Public URL of this API (one-click unsubscribe target). */
  @IsUrl({ require_tld: false })
  API_PUBLIC_URL: string;

  @IsEmail()
  ADMIN_EMAIL: string;

  @IsString()
  @MinLength(12)
  ADMIN_PASSWORD: string;

  @IsOptional()
  @IsString()
  ADMIN_FIRST_NAME?: string;

  @IsOptional()
  @IsString()
  ADMIN_LAST_NAME?: string;

  @IsIn(['OAUTH2', 'APP_PASSWORD', 'SMTP', 'NONE'])
  MAIL_AUTH_MODE: MailAuthMode = 'OAUTH2';

  /** The Google Workspace mailbox that sends everything. */
  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE !== 'NONE')
  @IsEmail()
  MAIL_USER?: string;

  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE === 'OAUTH2')
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE === 'OAUTH2')
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE === 'OAUTH2')
  @IsString()
  GOOGLE_REFRESH_TOKEN?: string;

  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE === 'APP_PASSWORD')
  @IsString()
  @MinLength(16)
  MAIL_APP_PASSWORD?: string;

  /** Plain SMTP for local development (e.g. Mailpit). */
  @ValidateIf((e: EnvironmentVariables) => e.MAIL_AUTH_MODE === 'SMTP')
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  COOKIE_SECURE?: boolean;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  SCHEDULER_ENABLED?: boolean = true;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map(
      (e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(
      `Invalid environment configuration:\n  ${details.join('\n  ')}`,
    );
  }
  return validated;
}
