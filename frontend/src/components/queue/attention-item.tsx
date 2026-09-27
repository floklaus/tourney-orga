"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateTimeWithZone, formatRelative } from "@/lib/dates";
import { dayNumber, formatDay, isValidDay, todayIn } from "@/lib/days";
import { cn, pluralize } from "@/lib/format";
import type { AttentionItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { participationVariablesHref, tournamentVariablesHref } from "@/components/variables/variables-link";
import {
  detailKeys,
  failedDetails,
  itemHref,
  itemStepName,
  itemTeams,
  LINK_LABELS,
  missingVariablesDetails,
  participationDetails,
  SEVERITY_BORDERS,
  SEVERITY_LABELS,
  SEVERITY_TONES,
  stepGroupDetails,
  TYPE_LABELS,
} from "./attention-meta";
import type { AttentionActions } from "./use-attention-actions";

const T = {
  step: "Email",
  due: "Due",
  dueToday: "Due today",
  dueInDays: (n: number) => `Due in ${n} day${n === 1 ? "" : "s"}`,
  overdueDays: (n: number) => `Overdue by ${n} day${n === 1 ? "" : "s"}`,
  emails: (n: number) => pluralize(n, "email"),
  teams: (n: number) => pluralize(n, "team"),
  tournament: "Tournament",
  teamsLabel: "Affected teams",
  moreTeams: (n: number) => `+${n} more`,
  missingTeams: "Teams with missing values",
  failuresTitle: "Not possible for",
  checkVariables: "Check the tournament variables",
  advanceAll: (label: string) => `Advance all to ${label}`,
  sendNow: (n: number) => `Send now (${n})`,
  prepareNow: (n: number) => `Prepare now (${n})`,
  skip: "Skip",
  sendManually: (n: number | null) => (n ? `Send manually (${n})` : "Send manually"),
  resend: "Resend all",
  retryManually: "Retry all manually",
  dismiss: "Dismiss all",
  resume: "Resume sending",
  severity: (label: string) => `${label} priority`,
};

const linkClass =
  "inline-flex items-center rounded-md bg-brand-primary px-2.5 py-1.5 text-sm font-medium text-white hover:bg-brand-primary-hover";

interface Props {
  item: AttentionItem;
  timeZone: string;
  nowMs: number;
  actions: AttentionActions;
  /** Dashboard variant: no description, smaller spacing. */
  compact?: boolean;
}

/** Participation items are due on a calendar day (details.dueDate, YYYY-MM-DD), not at a time. */
/** Ready and failed items count emails; all other counted items count teams (one email per team). */
const countsEmails = (item: AttentionItem) => item.type === "READY_TO_SEND" || item.type === "FAILED_DELIVERIES";

function dueDay(item: AttentionItem): string | null {
  const value = (item.details as { dueDate?: unknown }).dueDate;
  return typeof value === "string" && isValidDay(value) ? value : null;
}

function DueDay({ day, timeZone, nowMs }: { day: string; timeZone: string; nowMs: number }) {
  const diff = dayNumber(day) - dayNumber(todayIn(nowMs, timeZone));
  const relative =
    diff === 0 ? T.dueToday : diff > 0 ? T.dueInDays(diff) : T.overdueDays(-diff);
  return (
    <span className={diff < 0 ? "font-medium text-red-800" : undefined}>
      <time dateTime={day}>{relative}</time>
      <span className="text-slate-600"> · {formatDay(day)}</span>
    </span>
  );
}

function Due({ iso, timeZone, nowMs }: { iso: string; timeZone: string; nowMs: number }) {
  const absolute = formatDateTimeWithZone(iso, timeZone);
  const overdue = new Date(iso).getTime() < nowMs;
  return (
    <span className={overdue ? "font-medium text-red-800" : undefined}>
      {T.due}{" "}
      <time dateTime={iso} title={absolute}>
        {formatRelative(iso, nowMs)}
      </time>
      <span className="text-slate-600"> · {absolute}</span>
    </span>
  );
}

function Context({ item }: { item: AttentionItem }) {
  const parts: ReactNode[] = [];
  if (item.tournament) {
    parts.push(
      <span key="t">
        {T.tournament}:{" "}
        <Link href={`/tournaments/${item.tournament.id}`} className="text-brand-primary underline">
          {item.tournament.name}
        </Link>
      </span>,
    );
  }
  const stepName = itemStepName(item);
  if (stepName) {
    parts.push(
      <span key="s">
        {T.step}: {stepName}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">{parts}</p>;
}

function GoLink({ item, label }: { item: AttentionItem; label: string }) {
  const href = itemHref(item);
  if (!href) return null;
  const text = LINK_LABELS[item.type] ?? "Open";
  return (
    <Link href={href} className={linkClass} aria-label={`${text} – ${label}`}>
      {text}
    </Link>
  );
}

function PrimaryActions({ item, actions }: { item: AttentionItem; actions: AttentionActions }) {
  const busy = actions.busyId === item.id;
  const disabled = actions.busyId !== null;
  const label = `${TYPE_LABELS[item.type]}: ${itemStepName(item) ?? item.tournament?.name ?? item.title}`;
  switch (item.type) {
    case "PAST_DUE": {
      const n = stepGroupDetails(item)?.stepIds.length ?? 0;
      const sendLabel = actions.manual ? T.prepareNow(n) : T.sendNow(n);
      return (
        <>
          <Button size="sm" onClick={() => actions.confirm("send-now", item)} disabled={disabled || n === 0} aria-label={`${sendLabel} – ${label}`}>
            {sendLabel}
          </Button>
          <Button size="sm" variant="danger-outline" onClick={() => actions.confirm("skip", item)} disabled={disabled || n === 0} aria-label={`${T.skip} – ${label}`}>
            {T.skip}
          </Button>
        </>
      );
    }
    case "READY_TO_SEND":
      return (
        <>
          <Button size="sm" onClick={() => actions.openWalkthrough(item)} loading={busy} disabled={disabled || !item.tournament} aria-label={`${T.sendManually(item.count)} – ${label}`}>
            {T.sendManually(item.count)}
          </Button>
          <GoLink item={item} label={label} />
        </>
      );
    case "FAILED_DELIVERIES": {
      const n = failedDetails(item)?.deliveryIds.length ?? 0;
      const resendLabel = actions.manual ? T.retryManually : T.resend;
      return (
        <>
          <GoLink item={item} label={label} />
          <Button size="sm" variant="secondary" onClick={() => actions.confirm("resend", item)} disabled={disabled || n === 0} aria-label={`${resendLabel} – ${label}`}>
            {resendLabel}
          </Button>
          <Button size="sm" variant="danger-outline" onClick={() => actions.confirm("dismiss", item)} disabled={disabled || n === 0} aria-label={`${T.dismiss} – ${label}`}>
            {T.dismiss}
          </Button>
        </>
      );
    }
    case "PARTICIPATION_OVERDUE":
    case "PARTICIPATION_DUE_SOON": {
      const details = participationDetails(item);
      return (
        <>
          <GoLink item={item} label={item.title} />
          {details && details.participations.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => actions.confirm("advance-all", item)} disabled={disabled} aria-label={`${T.advanceAll(details.label)} – ${item.title}`}>
              {T.advanceAll(details.label)}
            </Button>
          )}
        </>
      );
    }
    case "SENDING_PAUSED":
      return (
        <Button size="sm" variant="secondary" onClick={() => actions.resume(item)} loading={busy} disabled={disabled}>
          {T.resume}
        </Button>
      );
    default:
      return <GoLink item={item} label={label} />;
  }
}

const MAX_CHIPS = 12;

function TeamChips({ item }: { item: AttentionItem }) {
  const teams = itemTeams(item);
  if (teams.length === 0) return null;
  const hidden = teams.length - MAX_CHIPS;
  return (
    <ul aria-label={T.teamsLabel} className="flex flex-wrap gap-1">
      {teams.slice(0, MAX_CHIPS).map((team, i) => (
        <li key={`${team}-${i}`}>
          <Badge tone="teal">{team}</Badge>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <Badge>{T.moreTeams(hidden)}</Badge>
        </li>
      )}
    </ul>
  );
}

/** MISSING_VARIABLES: each team with its missing keys, linking to its per-team overrides. */
function MissingTeams({ item, compact }: { item: AttentionItem; compact: boolean }) {
  const teams = missingVariablesDetails(item);
  if (teams.length === 0) return null;
  const shown = compact ? teams.slice(0, 3) : teams.slice(0, MAX_CHIPS);
  const hidden = teams.length - shown.length;
  return (
    <div>
      <p className="text-xs font-medium text-slate-700">{T.missingTeams}</p>
      <ul className="mt-0.5 space-y-0.5 text-sm">
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={participationVariablesHref(p.id)} className="text-brand-primary underline">
              {p.teamName}
            </Link>
            {p.missing.length > 0 && <span className="text-slate-700">: {p.missing.join(", ")}</span>}
          </li>
        ))}
        {hidden > 0 && <li className="text-slate-600">{T.moreTeams(hidden)}</li>}
      </ul>
    </div>
  );
}

/** Parts of the last bulk action on this item that failed (e.g. blocked by missing variables). */
function Failures({ item, actions }: { item: AttentionItem; actions: AttentionActions }) {
  const failures = actions.failures[item.id] ?? [];
  if (failures.length === 0) return null;
  return (
    <div role="status" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold">{T.failuresTitle}:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {failures.map((f, i) => (
          <li key={`${f.label}-${i}`}>
            {f.label}: {f.error}
          </li>
        ))}
      </ul>
      {item.tournament && (
        <p className="mt-1">
          <Link href={tournamentVariablesHref(item.tournament.id)} className="font-medium underline">
            {T.checkVariables}
          </Link>
        </p>
      )}
    </div>
  );
}

/** One work-queue entry: what is wrong, when it matters, and the action that resolves it. */
export function AttentionItemCard({ item, timeZone, nowMs, actions, compact = false }: Props) {
  const keys = detailKeys(item);
  return (
    <article
      aria-labelledby={`attention-${item.id}`}
      className={cn("rounded-md border border-l-4 border-slate-200 bg-white shadow-sm", SEVERITY_BORDERS[item.severity], compact ? "p-3" : "p-4")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`attention-${item.id}`} className="font-semibold text-slate-900">
              {item.title}
            </h3>
            <Badge tone={SEVERITY_TONES[item.severity]}>
              <span className="sr-only">{T.severity(SEVERITY_LABELS[item.severity])}, </span>
              {TYPE_LABELS[item.type]}
            </Badge>
            {item.count !== null && item.count > 0 && <Badge>{countsEmails(item) ? T.emails(item.count) : T.teams(item.count)}</Badge>}
          </div>
          {!compact && item.description && <p className="text-sm text-slate-700">{item.description}</p>}
          {keys.length > 0 && (
            <p className="flex flex-wrap gap-1">
              {keys.map((key) => (
                <code key={key} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-950 ring-1 ring-inset ring-amber-300">
                  {key}
                </code>
              ))}
            </p>
          )}
          <TeamChips item={item} />
          <MissingTeams item={item} compact={compact} />
          <Context item={item} />
          {dueDay(item) ? (
            <p className="text-sm text-slate-700">
              <DueDay day={dueDay(item)!} timeZone={timeZone} nowMs={nowMs} />
            </p>
          ) : (
            item.dueAt && (
              <p className="text-sm text-slate-700">
                <Due iso={item.dueAt} timeZone={timeZone} nowMs={nowMs} />
              </p>
            )
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryActions item={item} actions={actions} />
        </div>
      </div>
      <Failures item={item} actions={actions} />
    </article>
  );
}
