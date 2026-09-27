"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { errorMessage, isConflict } from "@/lib/errors";
import { fullName } from "@/lib/format";
import type { ListState } from "@/lib/list-query";
import type { QueryResult } from "@/lib/use-api";
import type { Paginated, User } from "@/lib/types";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const T = {
  caption: "Admins",
  conflictHint: "You cannot deactivate yourself or the last active admin.",
  you: "(you)",
  active: "Active",
  deactivated: "Deactivated",
  selfTitle: "You cannot deactivate yourself",
  searchPlaceholder: "Name or email",
  empty: "No users",
  toggled: (name: string, wasActive: boolean) => `${name} ${wasActive ? "deactivated" : "activated"}.`,
};

interface Props {
  list: ListState;
  result: QueryResult<Paginated<User>>;
  currentUserId: string;
}

export function UsersTable({ list, result, currentUserId }: Props) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  async function toggle(user: User) {
    setBusyId(user.id);
    setConflict(null);
    try {
      await api.patch<User>(`/users/${user.id}`, { isActive: !user.isActive });
      toast.show(T.toggled(fullName(user), user.isActive));
      result.reload();
    } catch (err) {
      if (isConflict(err)) setConflict(`${errorMessage(err)} ${T.conflictHint}`);
      else toast.show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<User>[] = [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (user) => (
        <span className="font-medium text-slate-900">
          {fullName(user)} {user.id === currentUserId && <span className="text-xs font-normal text-slate-600">{T.you}</span>}
        </span>
      ),
    },
    { id: "email", header: "Email", className: "break-all", cell: (user) => user.email },
    { id: "status", header: "Status", cell: (user) => (user.isActive ? <Badge tone="green">{T.active}</Badge> : <Badge>{T.deactivated}</Badge>) },
    { id: "lastLoginAt", header: "Last login", sortKey: "lastLoginAt", hideOnMobile: true, className: "whitespace-nowrap", cell: (user) => formatDateTime(user.lastLoginAt) },
    {
      id: "action",
      header: "Action",
      align: "right",
      cell: (user) => {
        const isSelf = user.id === currentUserId;
        return (
          <Button
            size="sm"
            variant={user.isActive ? "danger-ghost" : "ghost"}
            onClick={() => toggle(user)}
            loading={busyId === user.id}
            disabled={isSelf}
            title={isSelf ? T.selfTitle : undefined}
            aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${fullName(user)}`}
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      {conflict && <Alert tone="warning">{conflict}</Alert>}
      <DataTable
        caption={T.caption}
        columns={columns}
        list={list}
        result={result}
        rowKey={(u) => u.id}
        searchPlaceholder={T.searchPlaceholder}
        emptyTitle={T.empty}
      />
    </div>
  );
}
