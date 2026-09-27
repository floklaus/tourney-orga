import { randomToken } from '../../common/crypto';
import { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function setSessionCookies(
  res: Response,
  sessionToken: string,
  secure: boolean,
): void {
  const base: CookieOptions = {
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
  res.cookie(SESSION_COOKIE, sessionToken, { ...base, httpOnly: true });
  res.cookie(CSRF_COOKIE, randomToken(24), { ...base, httpOnly: false });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}
