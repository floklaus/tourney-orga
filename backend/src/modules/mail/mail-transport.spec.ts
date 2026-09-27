import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { buildSmtpOptions, createNodemailerTransport } from './mail-transport';

const env = (values: Partial<EnvironmentVariables>) =>
  ({
    get: (key: keyof EnvironmentVariables) => values[key],
  }) as unknown as ConfigService<EnvironmentVariables, true>;

describe('buildSmtpOptions', () => {
  it('uses Gmail with OAuth2 (XOAUTH2) by default', () => {
    expect(
      buildSmtpOptions(
        env({
          MAIL_AUTH_MODE: 'OAUTH2',
          MAIL_USER: 'org@example.com',
          GOOGLE_CLIENT_ID: 'id',
          GOOGLE_CLIENT_SECRET: 'secret',
          GOOGLE_REFRESH_TOKEN: 'refresh',
        }),
      ),
    ).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: 'org@example.com',
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
      },
    });
  });

  it('supports Gmail app passwords', () => {
    expect(
      buildSmtpOptions(
        env({
          MAIL_AUTH_MODE: 'APP_PASSWORD',
          MAIL_USER: 'org@example.com',
          MAIL_APP_PASSWORD: 'abcd',
        }),
      ),
    ).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'org@example.com', pass: 'abcd' },
    });
  });

  it('supports plain SMTP for local development', () => {
    expect(
      buildSmtpOptions(env({ MAIL_AUTH_MODE: 'SMTP', SMTP_HOST: 'mailpit' })),
    ).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
    });
  });

  it('creates a transport exposing send and verify', () => {
    const transport = createNodemailerTransport(
      env({ MAIL_AUTH_MODE: 'SMTP', SMTP_HOST: 'localhost' }),
    );
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.verify).toBe('function');
  });

  it('has no SMTP options and a rejecting transport without a mailbox', async () => {
    expect(buildSmtpOptions(env({ MAIL_AUTH_MODE: 'NONE' }))).toBeNull();
    const transport = createNodemailerTransport(
      env({ MAIL_AUTH_MODE: 'NONE' }),
    );
    await expect(transport.verify()).rejects.toThrow(/No mailbox/);
  });
});
