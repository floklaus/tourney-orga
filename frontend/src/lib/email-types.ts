// Participation emails (api-contract v2.0): tournament email plan, per-participation email steps, variables.
import type { DeliveryStatus, IsoDateTime, NamedRef, UserRef, Uuid } from "./types";

export type TimingType = "ABSOLUTE" | "RELATIVE";
/** RELATIVE timing counts from the tournament start or end date (settings timezone). */
export type TimingAnchor = "START" | "END";

export interface EmailTiming {
  timingType: TimingType;
  sendAt: IsoDateTime | null;
  offsetDays: number | null;
  /** "HH:mm" */
  timeOfDay: string | null;
  anchor: TimingAnchor;
}

/** One planned email of a tournament; copied into each participation's email steps on sign-up. */
export interface EmailPlanItem extends EmailTiming {
  id: Uuid;
  name: string;
  templateId: Uuid;
  templateName: string | null;
  subjectOverride: string | null;
}

/** Plan item as sent in POST/PATCH /tournaments (`id` only for existing items). */
export type EmailPlanItemInput = EmailTiming & {
  id?: Uuid;
  name: string;
  templateId: Uuid;
  subjectOverride?: string | null;
};

export type EmailStepStatus = "SCHEDULED" | "PAUSED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

/** The single delivery of an email step (one email to the team's address + CC). */
export interface StepDelivery {
  id: Uuid;
  status: DeliveryStatus;
  sentManually: boolean;
  sentAt: IsoDateTime | null;
  lastError: string | null;
}

export interface EmailStep extends EmailTiming {
  id: Uuid;
  participationId: Uuid;
  planItemId: Uuid | null;
  name: string;
  templateId: Uuid | null;
  templateName: string | null;
  subjectOverride: string | null;
  resolvedSendAt: IsoDateTime | null;
  status: EmailStepStatus;
  isPastDue: boolean;
  /** Variable keys without an effective value; sending is blocked while non-empty. */
  missingVariables: string[];
  delivery: StepDelivery | null;
  sentAt: IsoDateTime | null;
  version: number;
  createdBy: UserRef | null;
  updatedBy: UserRef | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type EmailStepInput = EmailTiming & { name: string; templateId: Uuid; subjectOverride?: string | null };
export type EmailStepPatch = Partial<EmailStepInput> & { version: number };

export type StepBulkAction = "send-now" | "skip" | "pause" | "resume" | "cancel";
export type DeliveryBulkAction = "dismiss" | "resend";

/** Response of POST /steps/bulk and POST /deliveries/bulk. */
export interface BulkActionResult {
  results: { id: Uuid; ok: boolean; error?: string }[];
}

export type VariableSource = "PARTICIPATION" | "TOURNAMENT";

/** A {{tournament.vars.<key>}} used by an unsent email of one participation, with its effective value. */
export interface ParticipationRequiredVariable {
  key: string;
  /** Effective value (override, else tournament value); null when missing. */
  value: string | null;
  source: VariableSource | null;
  steps: NamedRef[];
}

/** A {{tournament.vars.<key>}} used by unsent emails of the tournament's participations. */
export interface TournamentRequiredVariable {
  key: string;
  hasValue: boolean;
  /** Non-withdrawn participations that lack an effective value. */
  missingFor: number;
  /** Names of the emails that use it. */
  usedBy: string[];
}

/** Email counts of a participation (list and detail responses). */
export interface EmailSummary {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
  ready: number;
  blocked: number;
  nextSendAt: IsoDateTime | null;
}
