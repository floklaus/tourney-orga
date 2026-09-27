import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../modules/user/user.entity';

export const IS_PUBLIC = 'isPublic';
export const SKIP_CSRF = 'skipCsrf';

/** Route needs no session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route is exempt from the CSRF header check (login, public links). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export type AuthenticatedRequest = Request & { user: User };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
