import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { EnvironmentVariables } from '../../config/env.validation';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface OutgoingMail {
  from: string;
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(mail: OutgoingMail): Promise<{ messageId: string }>;
  verify(): Promise<void>;
}

const GMAIL_HOST = 'smtp.gmail.com';
const GMAIL_SSL_PORT = 465;

export function buildSmtpOptions(
  env: ConfigService<EnvironmentVariables, true>,
): SMTPTransport.Options | null {
  const user = env.get('MAIL_USER', { infer: true });
  switch (env.get('MAIL_AUTH_MODE', { infer: true })) {
    case 'OAUTH2':
      return {
        host: GMAIL_HOST,
        port: GMAIL_SSL_PORT,
        secure: true,
        auth: {
          type: 'OAuth2',
          user,
          clientId: env.get('GOOGLE_CLIENT_ID', { infer: true }),
          clientSecret: env.get('GOOGLE_CLIENT_SECRET', { infer: true }),
          refreshToken: env.get('GOOGLE_REFRESH_TOKEN', { infer: true }),
        },
      };
    case 'APP_PASSWORD':
      return {
        host: GMAIL_HOST,
        port: GMAIL_SSL_PORT,
        secure: true,
        auth: { user, pass: env.get('MAIL_APP_PASSWORD', { infer: true }) },
      };
    case 'SMTP':
      return {
        host: env.get('SMTP_HOST', { infer: true }),
        port: env.get('SMTP_PORT', { infer: true }) ?? 1025,
        secure: false,
      };
    case 'NONE':
      return null;
  }
}

export function isMailConfigured(
  env: ConfigService<EnvironmentVariables, true>,
): boolean {
  return env.get('MAIL_AUTH_MODE', { infer: true }) !== 'NONE';
}

export function createNodemailerTransport(
  env: ConfigService<EnvironmentVariables, true>,
): MailTransport {
  const options = buildSmtpOptions(env);
  if (!options) {
    const notConfigured = () =>
      Promise.reject(
        new Error('No mailbox is configured (MAIL_AUTH_MODE=NONE)'),
      );
    return { send: notConfigured, verify: notConfigured };
  }
  const transporter = createTransport(options);
  return {
    async send(mail) {
      const info = await transporter.sendMail(mail);
      return { messageId: info.messageId };
    },
    async verify() {
      await transporter.verify();
    },
  };
}
