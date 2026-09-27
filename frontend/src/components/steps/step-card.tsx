"use client";

import type { ReactNode } from "react";
import { formatDateTimeWithZone, formatRelative } from "@/lib/dates";
import { describeRelative } from "@/lib/email-timing";
import { fullName } from "@/lib/format";
import type { EmailStep } from "@/lib/types";
import { Badge, DeliveryStatusBadge, StepStatusBadge } from "@/components/ui/badge";
import { participationVariablesHref, tournamentVariablesHref, VariablesLink } from "@/components/variables/variables-link";
import { StepActionButtons } from "./step-action-buttons";
import { blockedHintId, missingVariablesOfStep, type StepAction } from "./step-actions";

const T = {
  unresolved: "Send time not resolved",
  pastDue: "Past due",
  blocked: "Blocked",
  template: "Template",
  subject: "Subject",
  delivery: "Delivery",
  sent: "Sent",
  manually: "sent manually",
  changedBy: "Last changed by",
  fromPlan: "From the tournament plan",
  custom: "Added for this team",
  blockedTitle: (keys: string) => `Blocked – missing: ${keys}`,
  blockedHint: "This email cannot be sent or copied until these variables have a value.",
  fillTeam: "Set for this team",
  fillAll: "Set for all teams",
  pastDueAuto: "The send time has passed and the email was not sent automatically. Choose “Send now” or “Skip”.",
  pastDueManual: "The send time has passed and the email was not prepared. Choose “Prepare now” or “Skip”.",
};

interface Props {
  step: EmailStep;
  timeZone: string;
  nowMs: number;
  tournamentId: string;
  /** True while the server is in MANUAL sending mode. */
  manual?: boolean;
  onAction: (action: StepAction, step: EmailStep) => void;
}

function BlockedNotice({ step, tournamentId }: { step: EmailStep; tournamentId: string }) {
  const missing = missingVariablesOfStep(step);
  if (missing.length === 0) return null;
  return (
    <div id={blockedHintId(step)} className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold">{T.blockedTitle(missing.join(", "))}</p>
      <p className="mt-0.5">{T.blockedHint}</p>
      <p className="mt-1 flex flex-wrap gap-x-4">
        <VariablesLink href={participationVariablesHref(step.participationId)}>{T.fillTeam}</VariablesLink>
        <VariablesLink href={tournamentVariablesHref(tournamentId)}>{T.fillAll}</VariablesLink>
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="inline font-medium text-slate-800">{label}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

/** One email of a participation: when, what, its delivery, and the actions its status allows. */
export function StepCard({ step, timeZone, nowMs, tournamentId, manual = false, onAction }: Props) {
  const delivery = step.delivery;
  const unsent = step.status === "SCHEDULED" || step.status === "PAUSED";
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby={`step-${step.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`step-${step.id}`} className="font-semibold text-slate-900">
            {step.name}
          </h3>
          <p className="text-sm text-slate-700">
            <time dateTime={step.resolvedSendAt ?? undefined}>
              {step.resolvedSendAt ? formatDateTimeWithZone(step.resolvedSendAt, timeZone) : T.unresolved}
            </time>
            {unsent && step.resolvedSendAt && <span className="text-slate-600"> · {formatRelative(step.resolvedSendAt, nowMs)}</span>}
          </p>
          <p className="text-xs text-slate-600">
            {step.timingType === "RELATIVE" && `${describeRelative(step.offsetDays, step.timeOfDay, step.anchor)} · `}
            {step.planItemId ? T.fromPlan : T.custom}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {step.isPastDue && <Badge tone="red">{T.pastDue}</Badge>}
          {missingVariablesOfStep(step).length > 0 && <Badge tone="amber">{T.blocked}</Badge>}
          <StepStatusBadge status={step.status} />
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
        <Detail label={T.template}>{step.templateName ?? "—"}</Detail>
        {step.subjectOverride && <Detail label={T.subject}>{step.subjectOverride}</Detail>}
        {delivery && (
          <Detail label={T.delivery}>
            <DeliveryStatusBadge status={delivery.status} />
            {delivery.lastError && <span className="mt-1 block text-xs text-red-800">{delivery.lastError}</span>}
          </Detail>
        )}
        {(delivery?.sentAt ?? step.sentAt) && (
          <Detail label={T.sent}>
            {formatDateTimeWithZone(delivery?.sentAt ?? step.sentAt, timeZone)}
            {delivery?.sentManually && ` (${T.manually})`}
          </Detail>
        )}
        {step.updatedBy && <Detail label={T.changedBy}>{fullName(step.updatedBy)}</Detail>}
      </dl>

      {step.isPastDue && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{manual ? T.pastDueManual : T.pastDueAuto}</p>}
      <BlockedNotice step={step} tournamentId={tournamentId} />

      <div className="mt-3">
        <StepActionButtons step={step} onAction={onAction} manual={manual} />
      </div>
    </article>
  );
}
