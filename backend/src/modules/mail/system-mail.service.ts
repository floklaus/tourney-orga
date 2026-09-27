import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { SettingsService } from '../settings/settings.service';
import { brandLogoUrl, htmlToText, wrapInLayout } from './mail-layout';
import {
  isMailConfigured,
  MAIL_TRANSPORT,
  type MailTransport,
} from './mail-transport';

/** Sends app emails that are not team communication: invitations, password resets, tests. */
@Injectable()
export class SystemMailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly settings: SettingsService,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** False when the server runs without a mailbox (manual sending only). */
  get isAvailable(): boolean {
    return isMailConfigured(this.env);
  }

  assertAvailable(): void {
    if (!this.isAvailable) {
      throw new ConflictException(
        'No mailbox is configured on this server, so emails cannot be sent automatically',
      );
    }
  }

  async fromHeader(): Promise<string> {
    const { senderName } = await this.settings.get();
    const address = this.env.get('MAIL_USER', { infer: true }) ?? '';
    return senderName
      ? `"${senderName.replace(/"/g, '')}" <${address}>`
      : address;
  }

  async send(to: string, subject: string, bodyHtml: string): Promise<void> {
    this.assertAvailable();
    const { logoUrl } = await this.settings.get();
    const html = wrapInLayout({
      bodyHtml,
      logoUrl: brandLogoUrl(logoUrl, this.env.get('APP_URL', { infer: true })),
    });
    await this.transport.send({
      from: await this.fromHeader(),
      to,
      subject,
      html,
      text: htmlToText(html),
    });
  }
}
