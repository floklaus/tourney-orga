"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { useListQuery, type ListFilters } from "@/lib/list-query";
import { useGroups } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import { useListData } from "@/lib/use-list-data";
import type { Participation, Team } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ParticipationsTable } from "@/components/participations/participations-table";
import { useParticipationActions } from "@/components/participations/use-participation-actions";
import { AddToTournamentDialog } from "./add-to-tournament-dialog";
import { TeamForm } from "./team-form";

const T = {
  back: "← All teams",
  details: "Team details",
  tournaments: "Tournaments",
  addToTournament: "Add to tournament",
  archived: "Archived",
  unsubscribed: "Unsubscribed",
  archivedHint: "Archived teams receive no emails and are hidden in pickers.",
  unsubscribedHint: (at: string) => `This team unsubscribed on ${at} and receives no emails.`,
  archive: "Archive",
  unarchive: "Unarchive",
  resubscribe: "Resubscribe",
  delete: "Delete team",
  deleteMessage: (name: string) => `Permanently delete ${name}? Past deliveries are kept but anonymized. Consider archiving instead.`,
  saved: (name: string) => `${name} saved.`,
  updated: (name: string) => `${name} updated.`,
  deleted: (name: string) => `${name} deleted.`,
  added: (tournament: string) => `Added to ${tournament}.`,
};

export function TeamPage({ id }: { id: string }) {
  const team = useApi(`team:${id}`, () => api.get<Team>(`/teams/${id}`));
  return (
    <>
      <Link href="/teams" className="mb-2 inline-block text-sm font-medium text-brand-primary underline">
        {T.back}
      </Link>
      <QueryView {...team} onRetry={team.reload}>
        {(data) => <TeamView team={data} reload={team.reload} />}
      </QueryView>
    </>
  );
}

function TeamView({ team, reload }: { team: Team; reload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const groups = useGroups();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function update(action: "archive" | "unarchive" | "resubscribe") {
    setBusy(true);
    try {
      if (action === "resubscribe") await api.post(`/teams/${team.id}/resubscribe`);
      else await api.patch(`/teams/${team.id}`, { isArchived: action === "archive" });
      toast.show(T.updated(team.name));
      reload();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {team.name}
            {team.isArchived && <Badge>{T.archived}</Badge>}
            {team.unsubscribedAt && <Badge tone="amber">{T.unsubscribed}</Badge>}
          </span>
        }
        description={`${team.contactName} · ${team.email}`}
        actions={
          <>
            {team.unsubscribedAt && (
              <Button variant="secondary" onClick={() => update("resubscribe")} disabled={busy}>
                {T.resubscribe}
              </Button>
            )}
            <Button variant="secondary" onClick={() => update(team.isArchived ? "unarchive" : "archive")} loading={busy}>
              {team.isArchived ? T.unarchive : T.archive}
            </Button>
            <Button variant="danger-outline" onClick={() => setDeleting(true)}>
              {T.delete}
            </Button>
          </>
        }
      />
      {team.isArchived && <Alert className="mb-4">{T.archivedHint}</Alert>}
      {team.unsubscribedAt && <Alert tone="warning" className="mb-4">{T.unsubscribedHint(formatDateTime(team.unsubscribedAt))}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card title={T.details}>
          <TeamForm
            key={team.updatedAt}
            team={team}
            groups={groups.data ?? []}
            onSaved={(saved) => {
              toast.show(T.saved(saved.name));
              reload();
            }}
          />
        </Card>
        <TeamTournaments team={team} />
      </div>

      <ConfirmDialog
        open={deleting}
        title={T.delete}
        danger
        confirmLabel={T.delete}
        message={T.deleteMessage(team.name)}
        onConfirm={async () => {
          await api.delete(`/teams/${team.id}`);
          toast.show(T.deleted(team.name));
          router.replace("/teams");
        }}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}

/** This team's participations (filter[team] locked) plus "Add to tournament". */
function TeamTournaments({ team }: { team: Team }) {
  const toast = useToast();
  const [locked] = useState<ListFilters>(() => ({ team: [team.id] }));
  const list = useListQuery(locked);
  const table = useListData<Participation>("/participations", list);
  const { actions, dialogs } = useParticipationActions(table.reload);
  const [adding, setAdding] = useState(false);
  const addButton = <Button onClick={() => setAdding(true)}>{T.addToTournament}</Button>;

  return (
    <Card title={T.tournaments} actions={addButton}>
      <ParticipationsTable list={list} result={table} actions={actions} hideTeam emptyAction={addButton} />
      {dialogs}
      <AddToTournamentDialog
        open={adding}
        team={team}
        onClose={() => setAdding(false)}
        onAdded={(created) => {
          setAdding(false);
          toast.show(T.added(created.tournament.name));
          table.reload();
        }}
      />
    </Card>
  );
}
