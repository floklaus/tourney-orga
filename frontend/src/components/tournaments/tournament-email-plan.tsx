"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTimeWithZone } from "@/lib/dates";
import { describeTiming, estimateSendAt, sortByEstimate } from "@/lib/email-timing";
import { pluralize } from "@/lib/format";
import { useManualMode, useTimeZone } from "@/lib/queries";
import type { EmailPlanItem, EmailPlanItemInput, Tournament } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { EmailFormDialog, type EmailFormValue } from "@/components/steps/email-form-dialog";

const T = {
  title: "Email plan",
  intro:
    "The emails every team receives for this tournament. The plan is copied to a team when it signs up; changes here only affect teams added later, unless you apply the plan to existing participations.",
  add: "Add email",
  apply: "Apply plan to existing participations",
  applyTitle: "Apply the email plan",
  applyMessage:
    "Adds the plan’s emails that existing (not withdrawn) participations don’t have yet. Emails already copied are not changed. Emails whose send time has already passed are flagged past due.",
  applyLabel: "Apply plan",
  applied: (n: number) => (n === 0 ? "All participations already have every planned email." : `${pluralize(n, "email")} added to existing participations.`),
  empty: "No emails planned yet",
  emptyHint: "Add e.g. a welcome email, a waiver reminder three weeks before the start, and a thank-you after the end.",
  name: "Email",
  template: "Template",
  when: "When",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
  editLabel: (name: string) => `Edit ${name}`,
  deleteLabel: (name: string) => `Delete ${name}`,
  newTitle: "Add email to the plan",
  editTitle: (name: string) => `Edit planned email: ${name}`,
  save: "Save",
  addSubmit: "Add to plan",
  saved: "Email plan saved.",
  deleteTitle: "Remove planned email",
  deleteMessage: (name: string) =>
    `Remove “${name}” from the plan? Teams that already have this email keep it; remove it on their participation page if needed.`,
  deleted: (name: string) => `“${name}” removed from the plan.`,
  subject: (s: string) => `Subject: ${s}`,
};

const toInput = (item: EmailPlanItem): EmailPlanItemInput => ({
  id: item.id,
  name: item.name,
  templateId: item.templateId,
  subjectOverride: item.subjectOverride,
  timingType: item.timingType,
  sendAt: item.sendAt,
  offsetDays: item.offsetDays,
  timeOfDay: item.timeOfDay,
  anchor: item.anchor,
});

interface Props {
  tournament: Tournament;
  onSaved: () => void;
  /** Called after "apply" added emails (participants table and counts change). */
  onApplied: () => void;
}

/** Ordered list of the tournament's planned emails with add/edit/delete and "apply to existing". */
export function TournamentEmailPlan({ tournament, onSaved, onApplied }: Props) {
  const toast = useToast();
  const timeZone = useTimeZone();
  const manual = useManualMode();
  const plan = tournament.emailPlan ?? [];
  const items = sortByEstimate(plan, tournament, timeZone);
  const [editing, setEditing] = useState<{ item: EmailPlanItem | null } | null>(null);
  const [deleting, setDeleting] = useState<EmailPlanItem | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  async function savePlan(next: EmailPlanItemInput[]) {
    await api.patch<Tournament>(`/tournaments/${tournament.id}`, { emailPlan: next });
    onSaved();
  }

  async function submit(value: EmailFormValue) {
    const current = editing?.item;
    const others = plan.map(toInput);
    const next = current ? others.map((i) => (i.id === current.id ? { ...value, id: current.id } : i)) : [...others, value];
    await savePlan(next);
    toast.show(T.saved);
    setEditing(null);
  }

  const addButton = (
    <Button size="sm" onClick={() => setEditing({ item: null })}>
      {T.add}
    </Button>
  );

  return (
    <Card title={T.title} actions={addButton}>
      <p className="mb-3 text-sm text-slate-600">{T.intro}</p>
      {appliedCount !== null && (
        <Alert tone="success" className="mb-3">
          {T.applied(appliedCount)}
        </Alert>
      )}
      {items.length === 0 ? (
        <EmptyState title={T.empty} description={T.emptyHint} />
      ) : (
        <PlanTable items={items} tournament={tournament} timeZone={timeZone} onEdit={(item) => setEditing({ item })} onDelete={setDeleting} />
      )}
      {items.length > 0 && tournament.participantCount > 0 && (
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={() => setApplying(true)}>
            {T.apply}
          </Button>
        </div>
      )}

      <EmailFormDialog
        open={editing !== null}
        title={editing?.item ? T.editTitle(editing.item.name) : T.newTitle}
        initial={editing?.item ?? null}
        timeZone={timeZone}
        dates={tournament}
        manual={manual}
        submitLabel={editing?.item ? T.save : T.addSubmit}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={T.deleteTitle}
        danger
        confirmLabel={T.delete}
        message={deleting ? T.deleteMessage(deleting.name) : ""}
        onConfirm={async () => {
          if (!deleting) return;
          await savePlan(plan.filter((i) => i.id !== deleting.id).map(toInput));
          toast.show(T.deleted(deleting.name));
        }}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={applying}
        title={T.applyTitle}
        confirmLabel={T.applyLabel}
        message={T.applyMessage}
        onConfirm={async () => {
          const { added } = await api.post<{ added: number }>(`/tournaments/${tournament.id}/email-plan/apply`);
          setAppliedCount(added);
          toast.show(T.applied(added));
          onApplied();
        }}
        onClose={() => setApplying(false)}
      />
    </Card>
  );
}

interface TableProps {
  items: EmailPlanItem[];
  tournament: Tournament;
  timeZone: string;
  onEdit: (item: EmailPlanItem) => void;
  onDelete: (item: EmailPlanItem) => void;
}

function PlanTable({ items, tournament, timeZone, onEdit, onDelete }: TableProps) {
  return (
    <Table caption={T.title}>
      <thead>
        <tr>
          <Th>{T.name}</Th>
          <Th>{T.when}</Th>
          <Th>{T.template}</Th>
          <Th className="text-right">{T.actions}</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
      {items.map((item) => {
        const estimate = item.timingType === "RELATIVE" ? estimateSendAt(item, tournament, timeZone) : null;
        return (
          <tr key={item.id}>
            <th scope="row" className="px-3 py-2 text-left align-top font-medium text-slate-900">
              {item.name}
              {item.subjectOverride && <span className="block text-xs font-normal text-slate-600">{T.subject(item.subjectOverride)}</span>}
            </th>
            <Td>
              {describeTiming(item, timeZone)}
              {estimate && <span className="block text-xs text-slate-600">{formatDateTimeWithZone(estimate, timeZone)}</span>}
            </Td>
            <Td>{item.templateName ?? "—"}</Td>
            <Td className="text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(item)} aria-label={T.editLabel(item.name)}>
                  {T.edit}
                </Button>
                <Button size="sm" variant="danger-ghost" onClick={() => onDelete(item)} aria-label={T.deleteLabel(item.name)}>
                  {T.delete}
                </Button>
              </div>
            </Td>
          </tr>
        );
      })}
      </tbody>
    </Table>
  );
}
