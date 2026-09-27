import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { SystemMailService } from '../mail/system-mail.service';
import { User } from '../user/user.entity';
import { UpdateSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly mail: SystemMailService,
  ) {}

  @Get()
  async get() {
    return this.settings.toResponse(await this.settings.get());
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settings.toResponse(await this.settings.update(dto));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('test-email')
  async testEmail(@CurrentUser() user: User) {
    await this.mail.send(
      user.email,
      'Test email from Team Communication Planner',
      '<p>Your mailbox configuration works. 🎉</p>',
    );
    return null;
  }
}
