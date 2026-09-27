"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDayRange } from "@/lib/days";
import { listHref, useListQuery, type ListFilters } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { Participation, Tournament } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ParticipationsGanttPanel, useGanttData } from "@/components/participations/participations-gantt-panel";
import { ParticipationsTable } from "@/components/participations/participations-table";
import { useParticipationActions } from "@/components/participations/use-participation-actions";
import { AddTeamsDialog } from "./add-teams-dialog";
import { DeleteTournamentDialog } from "./delete-tournament-dialog";
import { AgeGroupChips, StatusSummary, TimingBadge } from "./tournament-badges";
import { TournamentEmailPlan } from "./tournament-email-plan";
import { TournamentFormDialog } from "./tournament-form-dialog";
import { TournamentTimelineCard } from "./tournament-timeline-card";
import { TournamentVariables } from "./tournament-variables";

const T = {
  back: "← All tournaments",
  edit: "Edit",
  delete: "Delete",
  website: "Tournament website",
  newTab: "(opens in a new tab)",
  ageGroups: "Age groups",
  progress: "Progress",
  participants: "Participants",
  addTeams: "Add teams",
  gantt: "Timeline chart",
  ganttHint: "Uses the same search and filters as the participants table above.",
  emails: "Delivery log",
  saved: "Tournament saved.",
  deleted: (name: string) => `${name} deleted.`,
};

const linkButton =
  "inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50";

export function TournamentDetail({ id }: { id: string }) {
  const tournament = useApi(`tournament:${id}`, () => api.get<Tournament>(`/tournaments/${id}`));
  return (
    <>
      <Link href="/tournaments" className="mb-2 inline-block text-sm font-medium text-brand-primary underline">
        {T.back}
      </Link>
      <QueryView {...tournament} onRetry={tournament.reload}>
        {(data) => <TournamentView tournament={data} reload={tournament.reload} />}
      </QueryView>
    </>
  );
}

function TournamentView({ tournament, reload }: { tournament: Tournament; reload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Remounting the participants section refetches its table and chart after teams were added.
  const [participantsKey, setParticipantsKey] = useState(0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {tournament.name} <TimingBadge timing={tournament.timing} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-slate-800">{formatDayRange(tournament.startDate, tournament.endDate)}</span>
            {tournament.ageGroups.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="sr-only">{T.ageGroups}:</span>
                <AgeGroupChips ageGroups={tournament.ageGroups} />
              </span>
            )}
            {tournament.url && (
              <a href={tournament.url} target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">
                {T.website} <span className="sr-only">{T.newTab}</span>
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
          </span>
        }
        actions={
          <>
            <Link href={listHref("/deliveries", { tournament: [tournament.id] })} className={linkButton}>
              {T.emails}
            </Link>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              {T.edit}
            </Button>
            <Button variant="danger-outline" onClick={() => setDeleting(true)}>
              {T.delete}
            </Button>
          </>
        }
      />
      {tournament.description && <p className="-mt-2 mb-6 max-w-3xl whitespace-pre-wrap text-sm text-slate-700">{tournament.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TournamentTimelineCard key={tournament.updatedAt} tournament={tournament} onSaved={reload} />
        <Card title={T.progress}>
          <StatusSummary counts={tournament.statusCounts} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TournamentEmailPlan
          tournament={tournament}
          onSaved={reload}
          onApplied={() => {
            reload();
            setParticipantsKey((k) => k + 1);
          }}
        />
        <TournamentVariables tournament={tournament} onSaved={() => {
            reload();
            setParticipantsKey((k) => k + 1);
          }}
        />
      </div>

      <Participants key={participantsKey} tournament={tournament} onAddTeams={() => setAddOpen(true)} onChanged={reload} />

      <TournamentFormDialog
        open={editOpen}
        tournament={tournament}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          toast.show(T.saved);
          reload();
        }}
      />
      <DeleteTournamentDialog
        tournament={deleting ? tournament : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          toast.show(T.deleted(tournament.name));
          router.replace("/tournaments");
        }}
      />
      <AddTeamsDialog open={addOpen} tournament={tournament} onClose={() => setAddOpen(false)} onAdded={() => {
          reload();
          setParticipantsKey((k) => k + 1);
        }}
      />
    </>
  );
}

function Participants({ tournament, onAddTeams, onChanged }: { tournament: Tournament; onAddTeams: () => void; onChanged: () => void }) {
  const [locked] = useState<ListFilters>(() => ({ tournament: [tournament.id] }));
  const list = useListQuery(locked);
  const table = useListData<Participation>("/participations", list);
  const gantt = useGanttData(list);
  const { actions, dialogs, timeZone } = useParticipationActions(() => {
    table.reload();
    gantt.reload();
    onChanged();
  });
  const addButton = <Button onClick={onAddTeams}>{T.addTeams}</Button>;

  return (
    <>
      <Card title={T.participants} actions={addButton} className="mt-6">
        <ParticipationsTable list={list} result={table} actions={actions} hideTournament emptyAction={addButton} />
      </Card>
      <Card title={T.gantt} className="mt-6">
        <p className="mb-3 text-sm text-slate-600">{T.ganttHint}</p>
        <ParticipationsGanttPanel list={list} result={gantt} actions={actions} timeZone={timeZone} withToolbar={false} />
      </Card>
      {dialogs}
    </>
  );
}
