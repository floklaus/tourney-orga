/**
 * QUOTA/AUTH: mailbox problem, pause sending. PERMANENT: recipient rejected.
 * TRANSIENT: provably not accepted, safe to retry. AMBIGUOUS: the connection
 * broke after the message may have been transmitted; retrying risks a duplicate.
 */
export type SmtpErrorKind =
  'QUOTA' | 'AUTH' | 'PERMANENT' | 'TRANSIENT' | 'AMBIGUOUS';

export interface SmtpErrorLike {
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
  message?: string;
}

const QUOTA_PATTERN = /5\.4\.5|sending limit exceeded|daily user sending/i;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000];
/** Errors raised before any message data could have reached the server. */
const PRE_DATA_CODES = new Set(['ECONNECTION', 'EDNS', 'EENVELOPE', 'ETLS']);
const PRE_DATA_COMMANDS = new Set([
  'CONN',
  'EHLO',
  'HELO',
  'LHLO',
  'STARTTLS',
  'MAIL FROM',
  'RCPT TO',
]);

export function classifySmtpError(error: SmtpErrorLike): SmtpErrorKind {
  const text = `${error.response ?? ''} ${error.message ?? ''}`;
  if (QUOTA_PATTERN.test(text)) return 'QUOTA';
  if (error.code === 'EAUTH' || error.responseCode === 535) return 'AUTH';
  if (error.responseCode && error.responseCode >= 500) return 'PERMANENT';
  if (error.responseCode && error.responseCode >= 400) return 'TRANSIENT';
  const command = error.command?.toUpperCase();
  if (
    (error.code && PRE_DATA_CODES.has(error.code)) ||
    (command && (PRE_DATA_COMMANDS.has(command) || command.startsWith('AUTH')))
  ) {
    return 'TRANSIENT';
  }
  return 'AMBIGUOUS';
}

/** Delay before the next attempt after `attempts` failed tries, or null to give up. */
export function nextRetryDelayMs(attempts: number): number | null {
  return RETRY_DELAYS_MS[attempts - 1] ?? null;
}
