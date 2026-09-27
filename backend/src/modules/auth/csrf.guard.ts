import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { SKIP_CSRF } from '../../common/decorators';
import { CSRF_COOKIE, CSRF_HEADER } from './session-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Double-submit cookie check for every state-changing request. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const cookie = (request.cookies as Record<string, string> | undefined)?.[
      CSRF_COOKIE
    ];
    const header = request.headers[CSRF_HEADER];
    if (
      typeof cookie !== 'string' ||
      typeof header !== 'string' ||
      !safeEqual(cookie, header)
    ) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
