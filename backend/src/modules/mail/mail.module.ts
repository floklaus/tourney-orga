import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createNodemailerTransport, MAIL_TRANSPORT } from './mail-transport';
import { SystemMailService } from './system-mail.service';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: createNodemailerTransport,
    },
    SystemMailService,
  ],
  exports: [MAIL_TRANSPORT, SystemMailService],
})
export class MailModule {}
