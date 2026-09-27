import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomToken, sha256 } from '../../common/crypto';
import { conflict } from '../../common/errors';
import { EnvironmentVariables } from '../../config/env.validation';
import { SystemMailService } from '../mail/system-mail.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

const RESET_TTL_MS = 60 * 60 * 1000;

interface SessionPayload {
  sub: string;
  v: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Verified against when the email is unknown, so response time does not reveal accounts.
  private readonly dummyHash = argon2.hash('dummy-password-for-timing', {
    type: argon2.argon2id,
  });

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly mail: SystemMailService,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.users.save({ ...user, lastLoginAt: new Date() });
  }

  issueSession(user: User): string {
    const payload: SessionPayload = { sub: user.id, v: user.tokenVersion };
    return this.jwt.sign(payload);
  }

  /** Returns the active user behind a session token, or null. */
  async resolveSession(token: string): Promise<User | null> {
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }
    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user || !user.isActive || user.tokenVersion !== payload.v) return null;
    return user;
  }

  /** Always succeeds from the caller's view so it cannot be used to probe accounts. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) return;
    if (!this.mail.isAvailable) {
      this.logger.warn(
        'Password reset requested, but no mailbox is configured to send the link',
      );
      return;
    }
    const token = randomToken();
    await this.users.save({
      ...user,
      passwordResetTokenHash: sha256(token),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const link = `${this.env.get('APP_URL', { infer: true })}/reset-password/${token}`;
    try {
      await this.mail.send(
        user.email,
        'Reset your password',
        `<p>Someone requested a password reset for your account.</p>
         <p><a href="${link}">Choose a new password</a> (valid for 1 hour).</p>
         <p>If this wasn't you, you can ignore this email.</p>`,
      );
    } catch (error) {
      // Same response as for unknown emails; the failure is only logged.
      this.logger.error(
        `Password reset email failed: ${(error as Error).message}`,
      );
    }
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const user = await this.users.findByResetTokenHash(sha256(token));
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw conflict('This reset link is invalid or has expired');
    }
    await this.users.save({
      ...user,
      passwordHash: await this.users.hashPassword(password),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      tokenVersion: user.tokenVersion + 1,
    });
  }
}
