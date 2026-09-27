import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, Public, SkipCsrf } from '../../common/decorators';
import { EnvironmentVariables } from '../../config/env.validation';
import { InvitationService } from '../user/invitation.service';
import { AcceptInvitationDto } from '../user/user.dto';
import { User } from '../user/user.entity';
import { toUserResponse } from '../user/user.mapper';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { clearSessionCookies, setSessionCookies } from './session-cookies';

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly invitations: InvitationService,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE } })
  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(dto.email, dto.password);
    setSessionCookies(res, this.auth.issueSession(user), this.secureCookies());
    return toUserResponse(user);
  }

  @Post('auth/logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    // Ends this device's session only; password reset/deactivation end all sessions.
    clearSessionCookies(res);
    return null;
  }

  @Get('auth/me')
  me(@CurrentUser() user: User) {
    return toUserResponse(user);
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: ONE_HOUR } })
  @Post('auth/password-reset/request')
  @HttpCode(200)
  async requestReset(@Body() dto: PasswordResetRequestDto) {
    await this.auth.requestPasswordReset(dto.email);
    return null;
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR } })
  @Post('auth/password-reset/confirm')
  @HttpCode(200)
  async confirmReset(@Body() dto: PasswordResetConfirmDto) {
    await this.auth.confirmPasswordReset(dto.token, dto.password);
    return null;
  }

  @Public()
  @Get('invitations/:token')
  async invitation(@Param('token') token: string) {
    const invitation = await this.invitations.validate(token);
    return { email: invitation.email, expiresAt: invitation.expiresAt };
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR } })
  @Post('invitations/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.invitations.accept(dto);
    setSessionCookies(res, this.auth.issueSession(user), this.secureCookies());
    return toUserResponse(user);
  }

  private secureCookies(): boolean {
    return (
      this.env.get('COOKIE_SECURE', { infer: true }) ??
      this.env.get('NODE_ENV', { infer: true }) === 'production'
    );
  }
}
