import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public, SkipCsrf } from '../../common/decorators';
import { notFound } from '../../common/errors';
import { TeamService } from '../team/team.service';

/** Public unsubscribe endpoints; POST is also the RFC 8058 one-click target. */
@Public()
@SkipCsrf()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('public/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly teams: TeamService) {}

  @Get(':token')
  async status(@Param('token') token: string) {
    const team = await this.findTeam(token);
    return { teamName: team.name, unsubscribed: team.unsubscribedAt !== null };
  }

  @Post(':token')
  @HttpCode(200)
  async unsubscribe(@Param('token') token: string) {
    const team = await this.teams.setUnsubscribed(
      await this.findTeam(token),
      true,
    );
    return { teamName: team.name, unsubscribed: true };
  }

  private async findTeam(token: string) {
    const team = await this.teams.findByUnsubscribeToken(token);
    if (!team) throw notFound('Unsubscribe link');
    return team;
  }
}
