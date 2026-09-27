import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://x',
  JWT_SECRET: 'x'.repeat(32),
  APP_URL: 'https://app.example.com',
  API_PUBLIC_URL: 'https://api.example.com',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'long-enough-pass',
  MAIL_USER: 'org@example.com',
};

describe('validateEnv', () => {
  it('requires OAuth2 credentials in the default mode', () => {
    expect(() => validateEnv(base)).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('accepts a complete app-password configuration and applies defaults', () => {
    const env = validateEnv({
      ...base,
      MAIL_AUTH_MODE: 'APP_PASSWORD',
      MAIL_APP_PASSWORD: 'abcdabcdabcdabcd',
      PORT: '4000',
    });
    expect(env).toMatchObject({
      PORT: 4000,
      NODE_ENV: 'development',
      SCHEDULER_ENABLED: true,
    });
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: 'short',
        MAIL_AUTH_MODE: 'SMTP',
        SMTP_HOST: 'localhost',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('runs without any mailbox in NONE mode', () => {
    const withoutMailbox: Record<string, string> = { ...base };
    delete withoutMailbox.MAIL_USER;
    expect(
      validateEnv({ ...withoutMailbox, MAIL_AUTH_MODE: 'NONE' }),
    ).toMatchObject({ MAIL_AUTH_MODE: 'NONE' });
    expect(() =>
      validateEnv({
        ...withoutMailbox,
        MAIL_AUTH_MODE: 'APP_PASSWORD',
        MAIL_APP_PASSWORD: 'x'.repeat(16),
      }),
    ).toThrow(/MAIL_USER/);
  });
});
