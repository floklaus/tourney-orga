"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDayRange, formatPlayDays } from "@/lib/days";
import type { ListState } from "@/lib/list-query";
import { useTimeZone } from "@/lib/queries";
import type { QueryResult } from "@/lib/use-api";
import type { Paginated, Participation } from "@/lib/types";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailsSummary, NextStep, ParticipationStatusBadge } from "./participation-badges";
import { ParticipationRowActions } from "./participation-row-actions";
import type { ParticipationActions } from "./use-participation-actions";

const T = {
  caption: "Participations",
  team: "Team",
  tournament: "Tournament",
  ageGroup: "Age group",
  days: "Days",
  status: "Status",
  next: "Next step",
  emails: "Emails",
  notes: "Notes",
  actions: "Actions",
  openDetails: (team: string) => `Open participation of ${team}`,
  searchPlaceholder: "Team, tournament or notes",
  bulkAdvance: "Advance to…",
  empty: "No participations yet",
  emptyHint: "Add teams to a tournament to track their sign-up, payment, roster and waivers.",
};

interface ColumnOptions {
  hideTournament: boolean;
  hideTeam: boolean;
  timeZone: string;
}

function participationColumns(actions: ParticipationActions, { hideTournament, hideTeam, timeZone }: ColumnOptions): Column<Participation>[] {
  const columns: Column<Participation>[] = [
    {
      id: "team",
      header: T.team,
      sortKey: "team",
      cell: (p) => (
        <>
          <Link href={`/participations/${p.id}`} className="font-medium text-brand-primary underline" aria-label={T.openDetails(p.team.name)}>
            {p.team.name}
          </Link>
          {p.team.groups.length > 0 && <span className="block text-xs text-slate-600">{p.team.groups.map((g) => g.name).join(", ")}</span>}
        </>
      ),
    },
    {
      id: "tournament",
      header: T.tournament,
      sortKey: "tournament",
      cell: (p) => (
        <>
          <Link href={hideTeam ? `/participations/${p.id}` : `/tournaments/${p.tournament.id}`} className="text-brand-primary underline">
            {p.tournament.name}
          </Link>
          <span className="block whitespace-nowrap text-xs text-slate-600">{formatDayRange(p.tournament.startDate, p.tournament.endDate)}</span>
        </>
      ),
    },
    { id: "days", header: T.days, hideOnMobile: true, cell: (p) => formatPlayDays(p.days, p.tournament.startDate, p.tournament.endDate) },
    { id: "ageGroup", header: T.ageGroup, hideOnMobile: true, cell: (p) => (p.ageGroup ? <Badge tone="teal">{p.ageGroup}</Badge> : <span className="text-slate-500">—</span>) },
    { id: "status", header: T.status, sortKey: "status", cell: (p) => <ParticipationStatusBadge participation={p} /> },
    { id: "next", header: T.next, sortKey: "nextDueDate", cell: (p) => <NextStep participation={p} /> },
    { id: "emails", header: T.emails, cell: (p) => <EmailsSummary participation={p} timeZone={timeZone} /> },
    {
      id: "notes",
      header: T.notes,
      hideOnMobile: true,
      className: "max-w-48",
      cell: (p) => (p.notes ? <span className="line-clamp-2 text-xs text-slate-700" title={p.notes}>{p.notes}</span> : <span className="text-slate-500">—</span>),
    },
    { id: "actions", header: T.actions, align: "right", cell: (p) => <ParticipationRowActions participation={p} actions={actions} /> },
  ];
  return columns.filter((c) => !(hideTournament && c.id === "tournament") && !(hideTeam && c.id === "team"));
}

interface Props {
  list: ListState;
  result: QueryResult<Paginated<Participation>>;
  actions: ParticipationActions;
  /** On a tournament page the tournament column is redundant. */
  hideTournament?: boolean;
  /** On a team page the team column is redundant (the tournament links to the participation). */
  hideTeam?: boolean;
  toolbarActions?: ReactNode;
  emptyAction?: ReactNode;
}

export function ParticipationsTable({ list, result, actions, hideTournament = false, hideTeam = false, toolbarActions, emptyAction }: Props) {
  const timeZone = useTimeZone();
  return (
    <DataTable
      caption={T.caption}
      columns={participationColumns(actions, { hideTournament, hideTeam, timeZone })}
      list={list}
      result={result}
      rowKey={(p) => p.id}
      rowLabel={(p) => `${p.team.name} (${p.tournament.name})`}
      rowClassName={(p) => (p.status === "WITHDRAWN" ? "bg-slate-50 text-slate-600" : undefined)}
      searchPlaceholder={T.searchPlaceholder}
      toolbarActions={toolbarActions}
      emptyTitle={T.empty}
      emptyDescription={T.emptyHint}
      emptyAction={emptyAction}
      bulkActions={(selected, clear) => (
        <Button size="sm" onClick={() => actions.bulk(selected, clear)}>
          {T.bulkAdvance}
        </Button>
      )}
    />
  );
}

export const PARTICIPATION_SEARCH_PLACEHOLDER = T.searchPlaceholder;
