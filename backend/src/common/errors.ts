import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export const notFound = (what: string) =>
  new NotFoundException(`${what} not found`);

export const conflict = (message: string) => new ConflictException(message);

export const unprocessable = (message: string, details?: unknown) =>
  new UnprocessableEntityException({ message, details });

/** Postgres unique-violation error code. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === '23505';
}
