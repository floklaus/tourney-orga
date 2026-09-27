"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { listHref } from "@/lib/list-query";
import { useAttention, useManualMode, useTimeZone } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import { useNow } from "@/lib/use-now";
import type { EmailStep, EmailStepInput, ParticipationDetail } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { WalkthroughDialog, type WalkthroughTarget } from "@/components/deliveries/walkthrough-dialog";
import { EmailFormDialog, type EmailFormValue } from "@/components/steps/email-form-dialog";
import { StepCard } from "@/components/steps/step-card";
import { useStepActions } from "@/components/steps/use-step-actions";

const T = {
  title: "Emails",
  add: "Add email",
  addTitle: (team: string) => `Add email for ${team}`,
  addSubmit: "Add email",
  editTitle: (name: string) => `Edit email: ${name}`,
  save: "Save",
  added: "Email added.",
  saved: "Email saved.",
  sendReady: (n: number) => `Send ready emails (${n})`,
  log: "Delivery log",
  empty: "No emails for this team",
  emptyHint: "Emails from the tournament’s email plan are copied here when the team signs up. You can also add an email just for this team.",
  withdrawn: "This team is withdrawn: its emails are not sent while it stays withdrawn.",
  walkTitle: (team: string) => `Send manually: ${team}`,
};

interface Props {
  participation: ParticipationDetail;
  /** Reloads the participation (counts, missing variables). */
  onChanged: () => void;
}

/** The participation's email steps with their delivery status and actions, plus "Add email". */
export function ParticipationEmails({ participation: p, onChanged }: Props) {
  const toast = useToast();
  const timeZone = useTimeZone();
  const manual = useManualMode();
  const nowMs = useNow();
  const attention = useAttention();
  const steps = useApi(`participation-steps:${p.id}`, () => api.get<EmailStep[]>(`/participations/${p.id}/steps`));
  const [form, setForm] = useState<{ step: EmailStep | null } | null>(null);
  const [walkthrough, setWalkthrough] = useState<WalkthroughTarget | null>(null);
  const scope = { filters: { tournament: [p.tournament.id], team: [p.team.id] } };

  function refresh() {
    steps.reload();
    onChanged();
    attention.reload();
  }

  function openMessage(step: EmailStep) {
    const delivery = step.delivery;
    if (!delivery) return;
    setWalkthrough({
      scope,
      title: T.walkTitle(p.team.name),
      start: {
        id: delivery.id,
        status: delivery.status,
        team: { id: p.team.id, name: p.team.name },
        tournament: { id: p.tournament.id, name: p.tournament.name },
        participationId: p.id,
        step: { id: step.id, name: step.name },
      },
    });
  }

  const stepActions = useStepActions({ onEdit: (step) => setForm({ step }), onOpenMessage: openMessage, onChanged: refresh, manual });

  async function submit(value: EmailFormValue) {
    const editing = form?.step;
    const input: EmailStepInput = value;
    if (editing) await api.patch<EmailStep>(`/steps/${editing.id}`, { ...input, version: editing.version });
    else await api.post<EmailStep>(`/participations/${p.id}/steps`, input);
    toast.show(editing ? T.saved : T.added);
    setForm(null);
    refresh();
  }

  const ready = p.emails?.ready ?? 0;

  return (
    <section aria-labelledby="participation-emails" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="participation-emails" className="text-base font-semibold text-slate-900">
          {T.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={listHref("/deliveries", scope.filters)} className="text-sm font-medium text-brand-primary underline">
            {T.log}
          </Link>
          {ready > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setWalkthrough({ scope, title: T.walkTitle(p.team.name) })}>
              {T.sendReady(ready)}
            </Button>
          )}
          <Button size="sm" onClick={() => setForm({ step: null })}>
            {T.add}
          </Button>
        </div>
      </div>
      {p.status === "WITHDRAWN" && (
        <Alert tone="warning" className="mb-3">
          {T.withdrawn}
        </Alert>
      )}
      <QueryView
        {...steps}
        onRetry={steps.reload}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title={T.empty} description={T.emptyHint} />}
      >
        {(data) => (
          <ol className="space-y-3" aria-label={T.title}>
            {data.map((step) => (
              <li key={step.id}>
                <StepCard step={step} timeZone={timeZone} nowMs={nowMs} tournamentId={p.tournament.id} manual={manual} onAction={stepActions.run} />
              </li>
            ))}
          </ol>
        )}
      </QueryView>

      <EmailFormDialog
        open={form !== null}
        title={form?.step ? T.editTitle(form.step.name) : T.addTitle(p.team.name)}
        initial={form?.step ?? null}
        timeZone={timeZone}
        dates={p.tournament}
        manual={manual}
        submitLabel={form?.step ? T.save : T.addSubmit}
        onClose={() => setForm(null)}
        onSubmit={submit}
        onConflictReload={() => {
          setForm(null);
          refresh();
        }}
      />
      {stepActions.dialog}
      <WalkthroughDialog target={walkthrough} onClose={() => setWalkthrough(null)} onChanged={refresh} />
    </section>
  );
}
