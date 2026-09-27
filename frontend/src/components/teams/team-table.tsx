"use client";

import Link from "next/link";
import type { Team } from "@/lib/types";
import type { Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type TeamAction = "edit" | "archive" | "unarchive" | "resubscribe" | "delete";

const T = {
  team: "Team",
  contact: "Contact",
  ageGroup: "Age group",
  classOf: (year: number) => `Class of ${year}`,
  actions: "Actions",
  archived: "Archived",
  unsubscribed: "Unsubscribed",
  cc: (list: string) => `CC: ${list}`,
};

function TeamActions({ team, onAction }: { team: Team; onAction: (action: TeamAction, team: Team) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => onAction("edit", team)} aria-label={`Quick edit ${team.name}`}>
        Quick edit
      </Button>
      {team.unsubscribedAt && (
        <Button size="sm" variant="ghost" onClick={() => onAction("resubscribe", team)} aria-label={`Resubscribe ${team.name}`}>
          Resubscribe
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => onAction(team.isArchived ? "unarchive" : "archive", team)} aria-label={`${team.isArchived ? "Unarchive" : "Archive"} ${team.name}`}>
        {team.isArchived ? "Unarchive" : "Archive"}
      </Button>
      <Button size="sm" variant="danger-ghost" onClick={() => onAction("delete", team)} aria-label={`Delete ${team.name}`}>
        Delete
      </Button>
    </div>
  );
}

export function teamColumns(onAction: (action: TeamAction, team: Team) => void): Column<Team>[] {
  return [
    {
      id: "name",
      header: T.team,
      sortKey: "name",
      cell: (team) => (
        <>
          <Link href={`/teams/${team.id}`} className="font-medium text-brand-primary underline">
            {team.name}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1">
            {team.isArchived && <Badge>{T.archived}</Badge>}
            {team.unsubscribedAt && <Badge tone="amber">{T.unsubscribed}</Badge>}
          </div>
        </>
      ),
    },
    {
      id: "ageGroup",
      header: T.ageGroup,
      sortKey: "ageGroup",
      cell: (team) =>
        team.graduationYear === null ? (
          <span className="text-slate-500">—</span>
        ) : (
          <>
            <div className="font-medium">{team.ageGroup}</div>
            <div className="text-xs text-slate-600">{T.classOf(team.graduationYear)}</div>
          </>
        ),
    },
    {
      id: "contact",
      header: T.contact,
      sortKey: "contactName",
      cell: (team) => (
        <>
          <div>{team.contactName}</div>
          <div className="break-all text-slate-700">{team.email}</div>
          {team.ccEmails.length > 0 && (
            <div className="text-xs text-slate-600" title={team.ccEmails.join(", ")}>
              {T.cc(team.ccEmails.join(", "))}
            </div>
          )}
        </>
      ),
    },
    { id: "actions", header: T.actions, align: "right", cell: (team) => <TeamActions team={team} onAction={onAction} /> },
  ];
}
