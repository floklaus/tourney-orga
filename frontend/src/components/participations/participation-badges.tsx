import { formatDateTime } from "@/lib/dates";
import { formatDay } from "@/lib/days";
import { cn } from "@/lib/format";
import { describeDue, progressOf, statusLabel } from "@/lib/participation";
import type { Participation, ParticipationStatus, StepState } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const T = {
  progress: (step: number, total: number) => `step ${step} of ${total}`,
  done: "Process complete",
  withdrawn: "Withdrawn",
  next: "Next",
};

function toneOf(status: ParticipationStatus): BadgeTone {
  if (status === "PARTICIPATED") return "green";
  if (status === "WITHDRAWN") return "gray";
  if (status === "SIGNED_UP") return "gray";
  return "blue";
}

/** Status with process progress, e.g. "Paid 2/8". */
export function ParticipationStatusBadge({ participation: p }: { participation: Pick<Participation, "status" | "steps"> }) {
  const progress = progressOf(p.status);
  return (
    <Badge tone={toneOf(p.status)} className={p.status === "WITHDRAWN" ? "line-through" : undefined}>
      {statusLabel(p.status, p)}
      {progress && (
        <>
          <span aria-hidden="true" className="ml-1 tabular-nums opacity-80">
            {progress.step}/{progress.total}
          </span>
          <span className="sr-only">, {T.progress(progress.step, progress.total)}</span>
        </>
      )}
    </Badge>
  );
}

/** Next step and its due date; overdue in red with the number of days. */
export function NextStep({ participation: p }: { participation: Participation }) {
  if (p.status === "WITHDRAWN") return <span className="text-slate-600">{T.withdrawn}</span>;
  if (!p.nextStatus) return <span className="text-slate-600">{T.done}</span>;
  return (
    <span className="block whitespace-nowrap">
      <span className="font-medium text-slate-900">{statusLabel(p.nextStatus, p)}</span>
      <span className={cn("block text-xs", p.overdue ? "font-semibold text-red-800" : "text-slate-600")}>
        {formatDay(p.nextDueDate)}
        {p.daysUntilDue !== null && ` · ${describeDue(p.daysUntilDue)}`}
      </span>
    </span>
  );
}

export const STEP_STATE_LABELS: Record<StepState, string> = {
  DONE: "Done",
  NEXT: "Next",
  OVERDUE: "Overdue",
  UPCOMING: "Upcoming",
  WITHDRAWN: "Withdrawn",
};

const STEP_STATE_TONES: Record<StepState, BadgeTone> = {
  DONE: "green",
  NEXT: "blue",
  OVERDUE: "red",
  UPCOMING: "gray",
  WITHDRAWN: "gray",
};

export function StepStateBadge({ state }: { state: StepState }) {
  return <Badge tone={STEP_STATE_TONES[state]}>{STEP_STATE_LABELS[state]}</Badge>;
}

const EMAIL_T = {
  none: "No emails",
  sent: (sent: number, total: number) => `${sent}/${total} sent`,
  ready: (n: number) => `${n} ready`,
  failed: (n: number) => `${n} failed`,
  blocked: (n: number) => `${n} blocked`,
  missing: (keys: string) => `Missing: ${keys}`,
  missingShort: "Missing variables",
  next: "Next",
};

/** "3/5 sent" plus ready / failed / blocked / missing-variables badges, for tables. */
export function EmailsSummary({ participation: p, timeZone }: { participation: Participation; timeZone: string }) {
  const emails = p.emails;
  const missing = p.missingVariables ?? [];
  if (!emails || emails.total === 0) {
    return <span className="text-slate-500">{EMAIL_T.none}</span>;
  }
  return (
    <span className="block space-y-1">
      <span className="block whitespace-nowrap font-medium text-slate-900">{EMAIL_T.sent(emails.sent, emails.total)}</span>
      <span className="flex flex-wrap gap-1">
        {emails.ready > 0 && <Badge tone="purple">{EMAIL_T.ready(emails.ready)}</Badge>}
        {emails.failed > 0 && <Badge tone="red">{EMAIL_T.failed(emails.failed)}</Badge>}
        {emails.blocked > 0 && <Badge tone="amber">{EMAIL_T.blocked(emails.blocked)}</Badge>}
        {missing.length > 0 && (
          <Badge tone="amber">
            <span title={EMAIL_T.missing(missing.join(", "))}>{EMAIL_T.missingShort}</span>
            <span className="sr-only">: {missing.join(", ")}</span>
          </Badge>
        )}
      </span>
      {emails.nextSendAt && (
        <span className="block whitespace-nowrap text-xs text-slate-600">
          {EMAIL_T.next}: <time dateTime={emails.nextSendAt}>{formatDateTime(emails.nextSendAt, timeZone)}</time>
        </span>
      )}
    </span>
  );
}
