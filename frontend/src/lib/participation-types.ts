// Tournaments & participation process (api-contract v1.3 + v2.0 emails). Dates without time are "YYYY-MM-DD".
import type {
  EmailPlanItem,
  EmailPlanItemInput,
  EmailSummary,
  ParticipationRequiredVariable,
  TournamentRequiredVariable,
} from "./email-types";
import type { IsoDateTime, UserRef, Uuid } from "./types";

export type ParticipationStatus =
  | "SIGNED_UP"
  | "PAID"
  | "ADDED_TO_SPORTSENGINE"
  | "ADDED_TO_STAFF_CALENDAR"
  | "ROSTER_CONFIRMED"
  | "WAIVER_REQUESTED"
  | "WAIVER_CONFIRMED"
  | "PARTICIPATED"
  | "WITHDRAWN";

/** The 8 process steps (everything except WITHDRAWN). */
export type ProcessStatus = Exclude<ParticipationStatus, "WITHDRAWN">;

export type MilestoneAnchor = "START" | "END";
export type TournamentTiming = "UPCOMING" | "ONGOING" | "PAST";

export interface MilestoneInput {
  status: ProcessStatus;
  offsetDays: number;
  anchor: MilestoneAnchor;
}

export interface Milestone extends MilestoneInput {
  label: string;
  /** Computed; only in tournament responses. */
  dueDate: string;
}

/** GET/PUT /participation/defaults row. */
export interface MilestoneDefault extends MilestoneInput {
  label: string;
}

export interface ParticipationStatusInfo {
  status: ParticipationStatus;
  label: string;
  order: number;
  terminal: boolean;
}

export interface Tournament {
  id: Uuid;
  name: string;
  url: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  ageGroups: string[];
  timing: TournamentTiming;
  /** The 8 steps in process order. */
  milestones: Milestone[];
  /** Participations that are not withdrawn. */
  participantCount: number;
  statusCounts: Partial<Record<ParticipationStatus, number>>;
  /** Values of {{tournament.vars.<key>}} for all teams. */
  variables: Record<string, string>;
  /** Copied into a participation's email steps when it is created. */
  emailPlan: EmailPlanItem[];
  requiredVariables: TournamentRequiredVariable[];
  /** Keys missing for at least one non-withdrawn participation. */
  missingVariables: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TournamentInput {
  name: string;
  url?: string | null;
  startDate: string;
  endDate: string;
  description?: string | null;
  ageGroups?: string[];
  milestones?: MilestoneInput[];
  variables?: Record<string, string>;
  emailPlan?: EmailPlanItemInput[];
}

export type TournamentPatch = Partial<TournamentInput>;

export type StepState = "DONE" | "NEXT" | "OVERDUE" | "UPCOMING" | "WITHDRAWN";

export interface ParticipationStep {
  status: ProcessStatus;
  label: string;
  dueDate: string;
  /** When this step was reached (from the history). */
  completedAt: IsoDateTime | null;
  state: StepState;
}

export interface Participation {
  id: Uuid;
  tournament: { id: Uuid; name: string; startDate: string; endDate: string; timing: TournamentTiming };
  team: {
    id: Uuid;
    name: string;
    graduationYear: number | null;
    /** Calculated from the graduation year for the tournament's start date. */
    ageGroup: string | null;
  };
  /** Tournament days the team plays on (YYYY-MM-DD), at least one. */
  days: string[];
  ageGroup: string | null;
  status: ParticipationStatus;
  /** null when PARTICIPATED or WITHDRAWN. */
  nextStatus: ParticipationStatus | null;
  nextDueDate: string | null;
  overdue: boolean;
  /** Negative when overdue. */
  daysUntilDue: number | null;
  /** Always all 8 steps. */
  steps: ParticipationStep[];
  notes: string | null;
  withdrawnAt: IsoDateTime | null;
  /** Per-team overrides of the tournament variables (blank = no override). */
  variables: Record<string, string>;
  requiredVariables: ParticipationRequiredVariable[];
  missingVariables: string[];
  emails: EmailSummary;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StatusChange {
  id: Uuid;
  fromStatus: ParticipationStatus | null;
  toStatus: ParticipationStatus;
  note: string | null;
  changedBy: UserRef | null;
  changedAt: IsoDateTime;
}

export type ParticipationDetail = Participation & { history: StatusChange[] };

export interface BulkParticipationResult {
  created: Participation[];
  skipped: { teamId: Uuid; reason: string }[];
}

export interface BulkTransitionResult {
  results: { id: Uuid; ok: boolean; error?: string; participation?: Participation }[];
}
