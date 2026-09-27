import type { IsoDateTime, NamedRef } from "./types";

export type AttentionType =
  | "SENDING_PAUSED"
  | "MISSING_VARIABLES"
  | "PAST_DUE"
  | "READY_TO_SEND"
  | "FAILED_DELIVERIES"
  | "DUE_SOON"
  | "PARTICIPATION_OVERDUE"
  | "PARTICIPATION_DUE_SOON";

export type AttentionSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface AttentionItem {
  /** Stable id of the item. */
  id: string;
  type: AttentionType;
  severity: AttentionSeverity;
  title: string;
  description: string;
  dueAt: IsoDateTime | null;
  step: NamedRef | null;
  /** Null only for global items (SENDING_PAUSED). */
  tournament: NamedRef | null;
  /** READY_TO_SEND / FAILED_DELIVERIES: emails; PARTICIPATION_*: teams. */
  count: number | null;
  details: Record<string, unknown>;
}

export interface AttentionCounts {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AttentionResponse {
  items: AttentionItem[];
  counts: AttentionCounts;
}

/** `details` of PARTICIPATION_OVERDUE / PARTICIPATION_DUE_SOON items. */
export interface ParticipationAttentionDetails {
  /** The milestone that is due (the teams' next status). */
  status: string;
  label: string;
  dueDate: string;
  participations: { id: string; teamId: string; teamName: string }[];
}

/** `details` of MISSING_VARIABLES (per tournament). */
export interface MissingVariablesAttentionDetails {
  missingVariables: string[];
  participations: { id: string; teamName: string; missing: string[] }[];
}

/** `details` of PAST_DUE and DUE_SOON (per tournament and email name). */
export interface StepGroupAttentionDetails {
  stepName: string;
  stepIds: string[];
  teams: string[];
}

/** `details` of FAILED_DELIVERIES (per tournament). */
export interface FailedDeliveriesAttentionDetails {
  deliveryIds: string[];
  teams: string[];
}
