"use client";

import { useListQuery } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { User } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/layout/auth-context";
import { InvitationsPanel } from "./invitations-panel";
import { UsersTable } from "./users-table";

const T = {
  title: "Users",
  description: "All admins have the same rights. Deactivating a user ends their sessions immediately.",
  admins: "Admins",
  invitations: "Invitations",
};

export function UsersPage() {
  const { user } = useAuth();
  const list = useListQuery();
  const users = useListData<User>("/users", list);
  return (
    <>
      <PageHeader title={T.title} description={T.description} />
      <div className="space-y-6">
        <Card title={T.admins}>
          <UsersTable list={list} result={users} currentUserId={user.id} />
        </Card>
        <Card title={T.invitations}>
          <InvitationsPanel />
        </Card>
      </div>
    </>
  );
}
