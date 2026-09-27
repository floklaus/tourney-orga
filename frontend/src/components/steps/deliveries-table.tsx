"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { fullName } from "@/lib/format";
import type { Delivery } from "@/lib/types";
import { DeliveryStatusBadge } from "@/components/ui/badge";
import type { Column } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";

const T = {
  team: "Team",
  email: "Email / tournament",
  recipients: "Recipients",
  status: "Status",
  sent: "Sent",
  details: "Details",
  action: "Action",
  deletedTeam: "Deleted team",
  scheduler: "scheduler",
  sendManually: "Send manually",
  markSent: "Mark as sent",
  resend: "Resend",
  view: "View message",
  undo: "Undo",
  warning: "Warning",
};

export type RowAction = "send-manually" | "mark-sent" | "resend" | "view" | "undo";

interface ActionProps {
  manual: boolean;
  busyId: string | null;
  onAction: (action: RowAction, delivery: Delivery) => void;
}

const teamName = (d: Delivery) => d.team?.name ?? T.deletedTeam;

function SentBy({ delivery }: { delivery: Delivery }) {
  if (delivery.status === "READY" || delivery.status === "QUEUED") return null;
  const who = delivery.sentManually
    ? `sent manually by ${fullName(delivery.markedSentBy)}`
    : `by ${delivery.triggeredBy ? fullName(delivery.triggeredBy) : T.scheduler}`;
  return <span className="block text-xs text-slate-600">{who}</span>;
}

function RowActions({ delivery: d, manual, busyId, onAction }: { delivery: Delivery } & ActionProps) {
  const name = teamName(d);
  const busy = busyId === d.id;
  const canSendManually = d.team !== null && (d.status === "READY" || d.status === "FAILED");
  const isManuallySent = d.status === "SENT" && d.sentManually;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {canSendManually && (
        <Button size="sm" variant={d.status === "READY" ? "primary" : "secondary"} onClick={() => onAction("send-manually", d)} aria-label={`${T.sendManually} to ${name}`}>
          {T.sendManually}
        </Button>
      )}
      {d.status === "FAILED" && (
        <Button size="sm" variant="ghost" onClick={() => onAction("mark-sent", d)} loading={busy} aria-label={`${T.markSent}: ${name}`}>
          {T.markSent}
        </Button>
      )}
      {d.status === "FAILED" && !manual && (
        <Button size="sm" variant="ghost" onClick={() => onAction("resend", d)} disabled={busy} aria-label={`${T.resend} to ${name}`}>
          {T.resend}
        </Button>
      )}
      {isManuallySent && d.team !== null && (
        <Button size="sm" variant="ghost" onClick={() => onAction("view", d)} aria-label={`${T.view} for ${name}`}>
          {T.view}
        </Button>
      )}
      {isManuallySent && (
        <Button size="sm" variant="danger-ghost" onClick={() => onAction("undo", d)} loading={busy} aria-label={`${T.undo} “sent” for ${name}`}>
          {T.undo}
        </Button>
      )}
    </div>
  );
}

/** QUEUED rows carry a "waiting" reason (e.g. missing variables), not a failure. */
function LastError({ delivery }: { delivery: Delivery }) {
  if (delivery.status === "QUEUED") {
    return (
      <span className="mt-1 block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 ring-1 ring-inset ring-amber-300">
        <span className="sr-only">{T.warning}: </span>
        {delivery.lastError}
      </span>
    );
  }
  return <span className="block text-red-800">{delivery.lastError}</span>;
}

function TeamCell({ delivery: d }: { delivery: Delivery }) {
  if (!d.team) return <span className="italic text-slate-500">{T.deletedTeam}</span>;
  if (!d.participationId) return <span className="font-medium text-slate-900">{d.team.name}</span>;
  return (
    <Link href={`/participations/${d.participationId}`} className="font-medium text-brand-primary underline">
      {d.team.name}
    </Link>
  );
}

function ContextCell({ delivery: d }: { delivery: Delivery }) {
  return (
    <>
      <span className="block font-medium text-slate-900">{d.step?.name ?? "—"}</span>
      {d.tournament && (
        <Link href={`/tournaments/${d.tournament.id}`} className="text-xs text-brand-primary underline">
          {d.tournament.name}
        </Link>
      )}
    </>
  );
}

/** Columns of a deliveries list (rendered by the generic DataTable). */
export function deliveryColumns(timeZone: string | undefined, actionProps: ActionProps): Column<Delivery>[] {
  return [
    { id: "team", header: T.team, sortKey: "team", cell: (d) => <TeamCell delivery={d} /> },
    { id: "email", header: T.email, sortKey: "tournament", cell: (d) => <ContextCell delivery={d} /> },
    {
      id: "recipients",
      header: T.recipients,
      className: "break-all",
      cell: (d) => (
        <>
          {d.toEmail}
          {d.ccEmails.length > 0 && <span className="block text-xs text-slate-600">CC {d.ccEmails.join(", ")}</span>}
        </>
      ),
    },
    {
      id: "status",
      header: T.status,
      sortKey: "status",
      cell: (d) => (
        <>
          <DeliveryStatusBadge status={d.status} />
          {d.attempts > 1 && <span className="block text-xs text-slate-600">{d.attempts} attempts</span>}
        </>
      ),
    },
    {
      id: "sentAt",
      header: T.sent,
      sortKey: "sentAt",
      className: "whitespace-nowrap",
      cell: (d) => (
        <>
          {formatDateTime(d.sentAt, timeZone)}
          <SentBy delivery={d} />
        </>
      ),
    },
    {
      id: "details",
      header: T.details,
      hideOnMobile: true,
      className: "max-w-xs text-xs",
      cell: (d) => (
        <>
          <span className="block text-slate-700">{d.renderedSubject}</span>
          {d.lastError && <LastError delivery={d} />}
          {d.skipReason && <span className="block text-amber-900">Skipped: {d.skipReason}</span>}
        </>
      ),
    },
    { id: "action", header: T.action, align: "right", cell: (d) => <RowActions delivery={d} {...actionProps} /> },
  ];
}
