"use client";

import { useState } from "react";
import { api, downloadUrl } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useListQuery } from "@/lib/list-query";
import { useGroups } from "@/lib/queries";
import { useListData } from "@/lib/use-list-data";
import type { Team } from "@/lib/types";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { ImportDialog } from "./import-dialog";
import { TeamFormDialog } from "./team-form-dialog";
import { teamColumns, type TeamAction } from "./team-table";

const T = {
  title: "Teams",
  description: "Teams receive emails through their contact person. Archived teams receive nothing and are hidden unless you include them with the “Archived” filter.",
  add: "New team",
  import: "Import CSV",
  export: "Export CSV",
  searchPlaceholder: "Name, contact or email",
  empty: "No teams yet",
  emptyHint: "Add a team or import a CSV file to get started.",
};

export function TeamsPage() {
  const toast = useToast();
  const groups = useGroups();
  const list = useListQuery();
  const teams = useListData<Team>("/teams", list);

  const [editing, setEditing] = useState<Team | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Team | null>(null);

  async function runAction(action: TeamAction, team: Team) {
    if (action === "edit") {
      setEditing(team);
      setFormOpen(true);
      return;
    }
    if (action === "delete") {
      setDeleting(team);
      return;
    }
    try {
      if (action === "resubscribe") await api.post(`/teams/${team.id}/resubscribe`);
      else await api.patch(`/teams/${team.id}`, { isArchived: action === "archive" });
      toast.show(`${team.name} updated.`);
      teams.reload();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <>
      <PageHeader
        title={T.title}
        description={T.description}
        actions={
          <>
            <a
              href={downloadUrl("/teams/export")}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {T.export}
            </a>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              {T.import}
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>{T.add}</Button>
          </>
        }
      />

      <DataTable
        caption={T.title}
        columns={teamColumns(runAction)}
        list={list}
        result={teams}
        rowKey={(t) => t.id}
        rowLabel={(t) => t.name}
        rowClassName={(t) => (t.isArchived ? "bg-slate-50" : undefined)}
        searchPlaceholder={T.searchPlaceholder}
        emptyTitle={T.empty}
        emptyDescription={T.emptyHint}
      />

      <TeamFormDialog
        open={formOpen}
        team={editing}
        groups={groups.data ?? []}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          toast.show(`${saved.name} saved.`);
          teams.reload();
        }}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(r) => {
          setImportOpen(false);
          toast.show(`Import finished: ${r.created} created, ${r.updated} updated.`);
          teams.reload();
          groups.reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete team"
        danger
        confirmLabel="Delete team"
        message={
          <p>
            Permanently delete <strong>{deleting?.name}</strong>? Past deliveries are kept but anonymized. Consider archiving instead.
          </p>
        }
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/teams/${deleting.id}`);
          toast.show(`${deleting.name} deleted.`);
          teams.reload();
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
