import { classifySmtpError, nextRetryDelayMs } from './smtp-error';

describe('classifySmtpError', () => {
  it('detects Gmail quota errors', () => {
    expect(
      classifySmtpError({
        responseCode: 550,
        response: '550 5.4.5 Daily user sending limit exceeded',
      }),
    ).toBe('QUOTA');
  });

  it('treats 5xx as permanent', () => {
    expect(
      classifySmtpError({
        responseCode: 553,
        response: '553 5.1.2 invalid address',
      }),
    ).toBe('PERMANENT');
  });

  it('treats explicit 4xx replies as transient (the server did not accept the message)', () => {
    expect(classifySmtpError({ responseCode: 421 })).toBe('TRANSIENT');
    expect(classifySmtpError({ responseCode: 451, command: 'DATA' })).toBe(
      'TRANSIENT',
    );
  });

  it('treats failures before the message was transmitted as transient', () => {
    expect(classifySmtpError({ code: 'ECONNECTION', command: 'CONN' })).toBe(
      'TRANSIENT',
    );
    expect(classifySmtpError({ code: 'EDNS' })).toBe('TRANSIENT');
    expect(classifySmtpError({ code: 'ETIMEDOUT', command: 'RCPT TO' })).toBe(
      'TRANSIENT',
    );
  });

  it('treats connection drops during or after DATA as ambiguous (may have been delivered)', () => {
    expect(classifySmtpError({ code: 'ETIMEDOUT', command: 'DATA' })).toBe(
      'AMBIGUOUS',
    );
    expect(
      classifySmtpError({ code: 'ESOCKET', message: 'Connection reset' }),
    ).toBe('AMBIGUOUS');
    expect(classifySmtpError({ code: 'EMESSAGE' })).toBe('AMBIGUOUS');
  });

  it('treats auth errors as configuration errors', () => {
    expect(classifySmtpError({ code: 'EAUTH', responseCode: 535 })).toBe(
      'AUTH',
    );
  });
});

describe('nextRetryDelayMs', () => {
  it('backs off 1, 5, 30 minutes then gives up', () => {
    expect(nextRetryDelayMs(1)).toBe(60_000);
    expect(nextRetryDelayMs(2)).toBe(300_000);
    expect(nextRetryDelayMs(3)).toBe(1_800_000);
    expect(nextRetryDelayMs(4)).toBeNull();
  });
});
