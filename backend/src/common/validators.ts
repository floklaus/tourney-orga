import {
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidTimezone } from '../modules/email/domain/send-time';

@ValidatorConstraint({ name: 'timezone' })
export class TimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTimezone(value);
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone, e.g. Europe/Berlin';
  }
}

export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Like @IsOptional(), but only skips validation when the field is absent.
 * An explicit null still fails the other validators (for NOT NULL columns).
 */
export const IsOptionalNonNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
