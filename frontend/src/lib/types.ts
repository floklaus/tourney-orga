// Types mirroring docs/api-contract.md (v1 + v1.1 manual sending + v1.3 lists & tournaments + v2.0 participation emails).
// Timestamps are ISO-8601 UTC strings.

import type { ListMeta } from "./list-query";

export * from "./attention-types";
export * from "./email-types";
export * from "./participation-types";

export type Uuid = string;
export type IsoDateTime = string;

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  meta?: ListMeta;
}

export interface Paginated<T> {
  items: T[];
  meta: ListMeta;
}

export interface NamedRef {
  id: Uuid;
  name: string;
}

export interface UserRef {
  id: Uuid;
  firstName: string;
  lastName: string;
}

export interface User {
  id: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface Invitation {
  id: Uuid;
  email: string;
  invitedBy: UserRef;
  expiresAt: IsoDateTime;
  acceptedAt: IsoDateTime | null;
  revokedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  /** Only in the POST /users/invitations and /resend responses. */
  inviteUrl?: string;
}

export interface InvitationInfo {
  email: string;
  expiresAt: IsoDateTime;
}

export interface Team {
  id: Uuid;
  name: string;
  contactName: string;
  email: string;
  ccEmails: string[];
  graduationYear: number | null;
  /** Calculated from the graduation year for today (server-side). */
  ageGroup: string | null;
  notes: string | null;
  isArchived: boolean;
  unsubscribedAt: IsoDateTime | null;
  groups: NamedRef[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TeamInput {
  name: string;
  contactName: string;
  email: string;
  ccEmails?: string[];
  graduationYear?: number | null;
  notes?: string | null;
  groupIds?: Uuid[];
}

export type TeamPatch = Partial<TeamInput> & { isArchived?: boolean };

export type ImportMode = "create" | "upsert";

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export interface TeamGroup {
  id: Uuid;
  name: string;
  description: string | null;
  teamCount: number;
}

export interface EmailTemplate {
  id: Uuid;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Placeholder {
  key: string;
  description: string;
}

export interface RenderInput {
  subject: string;
  bodyHtml: string;
  teamId?: Uuid;
  tournamentId?: Uuid;
  participationId?: Uuid;
}

export interface RenderedPreview {
  subject: string;
  html: string;
  text: string;
  /** Only when rendered for a tournament or participation: tournament.vars keys without a value. */
  missingVariables?: string[];
}

export type DeliveryStatus = "QUEUED" | "READY" | "SENT" | "FAILED" | "SKIPPED";

export interface Delivery {
  id: Uuid;
  stepId: Uuid;
  /** Set in GET /deliveries (the cross-team list). */
  step?: NamedRef | null;
  tournament?: NamedRef | null;
  participationId?: Uuid | null;
  /** Null once the team was deleted (delivery anonymized). */
  team: NamedRef | null;
  toEmail: string;
  ccEmails: string[];
  renderedSubject: string;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  skipReason: string | null;
  sentAt: IsoDateTime | null;
  triggeredBy: UserRef | null;
  sentManually: boolean;
  markedSentBy: UserRef | null;
  createdAt: IsoDateTime;
}

/** Everything needed to send a delivery by hand from the organizer's own mail program. */
export interface ManualMessage {
  deliveryId: Uuid;
  status: DeliveryStatus;
  to: string;
  cc: string[];
  subject: string;
  /** Body + footer with unsubscribe link, without the outer email layout. */
  html: string;
  text: string;
  /** mailto: with to, cc, subject and the (possibly truncated) plain-text body. */
  mailtoUrl: string;
  mailtoTruncated: boolean;
}

export type AuthMode = "OAUTH2" | "APP_PASSWORD" | "SMTP" | "NONE";
export type SendingMode = "AUTOMATIC" | "MANUAL";

export interface Settings {
  organizerName: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  timezone: string;
  /** Month (1–12) in which the school year and all age groups roll over. */
  seasonStartMonth: number;
  footerHtml: string | null;
  logoUrl: string | null;
  ratePerMinute: number;
  dailyRecipientCap: number;
  authMode: AuthMode;
  sendingMode: SendingMode;
  /** Read-only: false when the server has no mailbox configured (mode is then always MANUAL). */
  automaticSendingAvailable: boolean;
}

export type SettingsPatch = Partial<Omit<Settings, "senderEmail" | "authMode" | "automaticSendingAvailable">>;

export interface Quota {
  used: number;
  cap: number;
  remaining: number;
  pausedUntil: IsoDateTime | null;
  pauseReason: string | null;
}

export interface UnsubscribeInfo {
  teamName: string;
  unsubscribed: boolean;
}

/** `error.details` of the 422 returned while an email's variables are missing. */
export interface MissingVariablesDetails {
  missingVariables: string[];
}
