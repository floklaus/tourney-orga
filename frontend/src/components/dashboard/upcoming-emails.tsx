"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateTimeWithZone, formatRelative } from "@/lib/dates";
import { EMPTY_QUERY, MAX_LIMIT, toApiParams } from "@/lib/list-query";
import { useApi } from "@/lib/use-api";
import type { Participation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/page-header";
import { EmptyState, QueryView } from "@/components/ui/states";

const UPCOMING_LIMIT = 10;

const T = {
  title: "Upcoming emails",
  hint: "Next planned email per team, across upcoming and ongoing tournaments.",
  empty: "No emails planned",
  emptyHint: "Add emails to a tournament’s email plan; they are copied to each team that signs up.",
  goTournaments: "Go to tournaments",
  ready: (n: number) => `${n} ready`,
  failed: (n: number) => `${n} failed`,
  blocked: "Missing variables",
  all: "All participations",
};

/** Participations of upcoming/ongoing tournaments with a next send time, soonest first. */
async function loadUpcoming(): Promise<Participation[]> {
  const params = toApiParams({ ...EMPTY_QUERY, filters: { timing: ["UPCOMING", "ONGOING"] } }, {}, { page: 1, limit: MAX_LIMIT });
  const { items } = await api.list<Participation>("/participations", params);
  return items
    .filter((p) => p.status !== "WITHDRAWN" && p.emails?.nextSendAt)
    .sort((a, b) => (a.emails.nextSendAt ?? "").localeCompare(b.emails.nextSendAt ?? ""))
    .slice(0, UPCOMING_LIMIT);
}

export function UpcomingEmailsCard({ timeZone, nowMs }: { timeZone: string; nowMs: number }) {
  const upcoming = useApi("dashboard:upcoming-emails", loadUpcoming);
  return (
    <Card
      title={T.title}
      actions={
        <Link href="/participations" className="text-sm font-medium text-brand-primary underline">
          {T.all}
        </Link>
      }
    >
      <p className="-mt-2 mb-3 text-sm text-slate-600">{T.hint}</p>
      <QueryView
        {...upcoming}
        onRetry={upcoming.reload}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title={T.empty}
            description={T.emptyHint}
            action={
              <Link href="/tournaments" className="text-sm font-medium text-brand-primary underline">
                {T.goTournaments}
              </Link>
            }
          />
        }
      >
        {(items) => (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link href={`/participations/${p.id}`} className="font-medium text-brand-primary underline">
                    {p.team.name}
                  </Link>
                  <p className="text-sm text-slate-700">
                    {p.tournament.name}
                    {" · "}
                    <time dateTime={p.emails.nextSendAt ?? undefined} title={formatDateTimeWithZone(p.emails.nextSendAt, timeZone)}>
                      {formatDateTimeWithZone(p.emails.nextSendAt, timeZone)}
                    </time>
                    <span className="text-slate-600"> · {formatRelative(p.emails.nextSendAt, nowMs)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.emails.ready > 0 && <Badge tone="purple">{T.ready(p.emails.ready)}</Badge>}
                  {p.emails.failed > 0 && <Badge tone="red">{T.failed(p.emails.failed)}</Badge>}
                  {(p.missingVariables ?? []).length > 0 && <Badge tone="amber">{T.blocked}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Card>
  );
}
