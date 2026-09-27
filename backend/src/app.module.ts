import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeorm.options';
import { AuthModule } from './modules/auth/auth.module';
import { AttentionModule } from './modules/attention/attention.module';
import { EmailModule } from './modules/email/email.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TeamModule } from './modules/team/team.module';
import { TemplateModule } from './modules/template/template.module';
import { TournamentModule } from './modules/tournament/tournament.module';
import { UserModule } from './modules/user/user.module';

const API_RATE_LIMIT = { ttl: 60_000, limit: 300 };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
      // Tests must not pick up a developer's local .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (env: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(env.get('DATABASE_URL', { infer: true })),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [API_RATE_LIMIT],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    SettingsModule,
    MailModule,
    AuthModule,
    UserModule,
    TeamModule,
    TemplateModule,
    DeliveryModule,
    TournamentModule,
    EmailModule,
    AttentionModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
