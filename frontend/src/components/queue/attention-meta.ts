import { listHref } from "@/lib/list-query";
import { PROCESS_ORDER, statusIndex } from "@/lib/participation";
import type {
  AttentionItem,
  AttentionSeverity,
  AttentionType,
  FailedDeliveriesAttentionDetails,
  MissingVariablesAttentionDetails,
  ParticipationAttentionDetails,
  ParticipationStatus,
  StepGroupAttentionDetails,
} from "@/lib/types";
import type { BadgeTone } from "@/components/ui/badge";
import { tournamentVariablesHref } from "@/components/variables/variables-link";

export const SEVERITIES: AttentionSeverity[] = ["HIGH", "MEDIUM", "LOW"];

export const SEVERITY_LABELS: Record<AttentionSeverity, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const SEVERITY_TONES: Record<AttentionSeverity, BadgeTone> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "gray",
};

/** Left accent of an item card per severity. */
export const SEVERITY_BORDERS: Record<AttentionSeverity, string> = {
  HIGH: "border-l-red-600",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-slate-300",
};

/** Display order of the type filter chips. */
export const TYPE_ORDER: AttentionType[] = [
  "SENDING_PAUSED",
  "PAST_DUE",
  "PARTICIPATION_OVERDUE",
  "READY_TO_SEND",
  "MISSING_VARIABLES",
  "FAILED_DELIVERIES",
  "DUE_SOON",
  "PARTICIPATION_DUE_SOON",
];

export const TYPE_LABELS: Record<AttentionType, string> = {
  SENDING_PAUSED: "Sending paused",
  MISSING_VARIABLES: "Missing variables",
  PAST_DUE: "Past due",
  READY_TO_SEND: "Ready to send",
  FAILED_DELIVERIES: "Failed emails",
  DUE_SOON: "Due soon",
  PARTICIPATION_OVERDUE: "Participation overdue",
  PARTICIPATION_DUE_SOON: "Participation due soon",
};

export const isParticipationItem = (item: AttentionItem) =>
  item.type === "PARTICIPATION_OVERDUE" || item.type === "PARTICIPATION_DUE_SOON";

/** `details` of a PARTICIPATION_* item, validated (null if malformed). */
export function participationDetails(item: AttentionItem): ParticipationAttentionDetails | null {
  if (!isParticipationItem(item)) return null;
  const d = item.details as Partial<ParticipationAttentionDetails> | undefined;
  if (!d || typeof d.status !== "string") return null;
  const participations = Array.isArray(d.participations)
    ? d.participations.filter((p): p is ParticipationAttentionDetails["participations"][number] => typeof p?.id === "string")
    : [];
  return { status: d.status, label: typeof d.label === "string" ? d.label : d.status, dueDate: d.dueDate ?? "", participations };
}

/** The teams' current status: the step before the one that is due. */
function currentStatusBefore(due: string): ParticipationStatus | null {
  const index = statusIndex(due as ParticipationStatus);
  return index > 0 ? PROCESS_ORDER[index - 1] : null;
}

/** /participations filtered to the affected tournament, current status (and overdue). */
function participationsHref(item: AttentionItem): string | null {
  if (!item.tournament) return null;
  const details = participationDetails(item);
  const current = details ? currentStatusBefore(details.status) : null;
  return listHref("/participations", {
    tournament: [item.tournament.id],
    ...(current ? { status: [current] } : {}),
    ...(item.type === "PARTICIPATION_OVERDUE" ? { overdue: ["true"] } : {}),
  });
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** `details.missingVariables` of a MISSING_VARIABLES item, validated. */
export function detailKeys(item: AttentionItem): string[] {
  return item.type === "MISSING_VARIABLES" ? strings(item.details?.missingVariables) : [];
}

/** Teams of a MISSING_VARIABLES item with their missing keys, validated. */
export function missingVariablesDetails(item: AttentionItem): MissingVariablesAttentionDetails["participations"] {
  if (item.type !== "MISSING_VARIABLES") return [];
  const list = (item.details as Partial<MissingVariablesAttentionDetails>).participations;
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => typeof p?.id === "string")
    .map((p) => ({ id: p.id, teamName: typeof p.teamName === "string" ? p.teamName : p.id, missing: strings(p.missing) }));
}

/** `details` of PAST_DUE / DUE_SOON items (grouped per tournament and email name), validated. */
export function stepGroupDetails(item: AttentionItem): StepGroupAttentionDetails | null {
  if (item.type !== "PAST_DUE" && item.type !== "DUE_SOON") return null;
  const d = item.details as Partial<StepGroupAttentionDetails>;
  return { stepName: typeof d.stepName === "string" ? d.stepName : (item.step?.name ?? ""), stepIds: strings(d.stepIds), teams: strings(d.teams) };
}

/** `details` of a FAILED_DELIVERIES item, validated. */
export function failedDetails(item: AttentionItem): FailedDeliveriesAttentionDetails | null {
  if (item.type !== "FAILED_DELIVERIES") return null;
  const d = item.details as Partial<FailedDeliveriesAttentionDetails>;
  return { deliveryIds: strings(d.deliveryIds), teams: strings(d.teams) };
}

/** Team names shown as chips on an item. */
export function itemTeams(item: AttentionItem): string[] {
  if (isParticipationItem(item)) return (participationDetails(item)?.participations ?? []).map((p) => p.teamName);
  return stepGroupDetails(item)?.teams ?? failedDetails(item)?.teams ?? [];
}

/** Email name of step-level items (from details, else item.step). */
export function itemStepName(item: AttentionItem): string | null {
  return stepGroupDetails(item)?.stepName || item.step?.name || null;
}

const deliveriesHref = (tournamentId: string, status: string) => listHref("/deliveries", { status: [status], tournament: [tournamentId] });

/** Where a "go there" link of an item points to, or null for items handled inline. */
export function itemHref(item: AttentionItem): string | null {
  const tournamentId = item.tournament?.id;
  if (!tournamentId) return null;
  switch (item.type) {
    case "MISSING_VARIABLES":
      return tournamentVariablesHref(tournamentId);
    case "DUE_SOON":
      return listHref("/participations", { tournament: [tournamentId] });
    case "READY_TO_SEND":
      return deliveriesHref(tournamentId, "READY");
    case "FAILED_DELIVERIES":
      return deliveriesHref(tournamentId, "FAILED");
    case "PARTICIPATION_OVERDUE":
    case "PARTICIPATION_DUE_SOON":
      return participationsHref(item);
    default:
      return null;
  }
}

export const LINK_LABELS: Partial<Record<AttentionType, string>> = {
  MISSING_VARIABLES: "Fill in variables",
  DUE_SOON: "Open participations",
  READY_TO_SEND: "Open list",
  FAILED_DELIVERIES: "Review failed",
  PARTICIPATION_OVERDUE: "Open participations",
  PARTICIPATION_DUE_SOON: "Open participations",
};
