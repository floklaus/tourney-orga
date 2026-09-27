"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { listHref, useListQuery } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { TeamGroup } from "@/lib/types";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { GroupFormDialog } from "./group-form-dialog";

const T = {
  title: "Groups",
  description: "Group teams to find and filter them quickly, e.g. by club or region.",
  add: "New group",
  empty: "No groups yet",
  emptyHint: "Create a group such as “Summer Cup 2026” or “Youth teams”.",
  searchPlaceholder: "Name or description",
  teamsOf: (n: number, name: string) => `${n} teams in ${name}`,
};

function groupColumns(onEdit: (g: TeamGroup) => void, onDelete: (g: TeamGroup) => void): Column<TeamGroup>[] {
  return [
    { id: "name", header: "Name", sortKey: "name", cell: (g) => <span className="font-medium text-slate-900">{g.name}</span> },
    { id: "description", header: "Description", hideOnMobile: true, cell: (g) => <span className="text-slate-700">{g.description ?? "—"}</span> },
    {
      id: "teams",
      header: "Teams",
      sortKey: "teamCount",
      align: "right",
      cell: (g) => (
        <Link href={listHref("/teams", { group: [g.id] })} className="text-brand-primary underline" aria-label={T.teamsOf(g.teamCount, g.name)}>
          {g.teamCount}
        </Link>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(g)} aria-label={`Edit ${g.name}`}>
            Edit
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={() => onDelete(g)} aria-label={`Delete ${g.name}`}>
            Delete
          </Button>
        </div>
      ),
    },
  ];
}

export function GroupsPage() {
  const toast = useToast();
  const list = useListQuery();
  const groups = useListData<TeamGroup>("/groups", list);
  const [editing, setEditing] = useState<TeamGroup | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TeamGroup | null>(null);

  const openForm = (group: TeamGroup | null) => {
    setEditing(group);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={<Button onClick={() => openForm(null)}>{T.add}</Button>} />
      <DataTable
        caption={T.title}
        columns={groupColumns(openForm, setDeleting)}
        list={list}
        result={groups}
        rowKey={(g) => g.id}
        searchPlaceholder={T.searchPlaceholder}
        emptyTitle={T.empty}
        emptyDescription={T.emptyHint}
        emptyAction={<Button onClick={() => openForm(null)}>{T.add}</Button>}
      />
      <GroupFormDialog
        open={formOpen}
        group={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          toast.show(`${saved.name} saved.`);
          groups.reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete group"
        danger
        confirmLabel="Delete group"
        message={
          <p>
            Delete <strong>{deleting?.name}</strong>? Teams stay, they are only removed from this group.
          </p>
        }
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/groups/${deleting.id}`);
          toast.show(`${deleting.name} deleted.`);
          groups.reload();
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
