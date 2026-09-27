"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { useListQuery } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { EmailTemplate } from "@/lib/types";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

const T = {
  title: "Templates",
  description: "Reusable emails with placeholders. Editing a template only affects emails that have not been sent yet.",
  add: "New template",
  empty: "No templates yet",
  emptyHint: "Create your first template, e.g. an invitation or a reminder.",
  searchPlaceholder: "Name or subject",
};

function templateColumns(onDuplicate: (t: EmailTemplate) => void, onDelete: (t: EmailTemplate) => void): Column<EmailTemplate>[] {
  return [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (t) => (
        <Link href={`/templates/${t.id}`} className="font-medium text-brand-primary underline">
          {t.name}
        </Link>
      ),
    },
    { id: "subject", header: "Subject", hideOnMobile: true, cell: (t) => <span className="text-slate-700">{t.subject}</span> },
    { id: "updatedAt", header: "Last changed", sortKey: "updatedAt", className: "whitespace-nowrap", cell: (t) => formatDateTime(t.updatedAt) },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(t)} aria-label={`Duplicate ${t.name}`}>
            Duplicate
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={() => onDelete(t)} aria-label={`Delete ${t.name}`}>
            Delete
          </Button>
        </div>
      ),
    },
  ];
}

const linkButton =
  "inline-flex items-center rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover";

export function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const list = useListQuery();
  const templates = useListData<EmailTemplate>("/templates", list);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);

  async function duplicate(template: EmailTemplate) {
    try {
      const copy = await api.post<EmailTemplate>(`/templates/${template.id}/duplicate`);
      toast.show(`Created “${copy.name}”.`);
      router.push(`/templates/${copy.id}`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const addLink = (
    <Link href="/templates/new" className={linkButton}>
      {T.add}
    </Link>
  );

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={addLink} />
      <DataTable
        caption={T.title}
        columns={templateColumns(duplicate, setDeleting)}
        list={list}
        result={templates}
        rowKey={(t) => t.id}
        searchPlaceholder={T.searchPlaceholder}
        emptyTitle={T.empty}
        emptyDescription={T.emptyHint}
        emptyAction={addLink}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete template"
        danger
        confirmLabel="Delete template"
        message={
          <p>
            Delete <strong>{deleting?.name}</strong>? This is not possible while an unsent email or a tournament email plan still uses it.
          </p>
        }
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/templates/${deleting.id}`);
          toast.show("Template deleted.");
          templates.reload();
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
