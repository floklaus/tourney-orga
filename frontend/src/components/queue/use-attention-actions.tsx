"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { useAttention, useManualMode } from "@/lib/queries";
import type { AttentionItem, BulkActionResult, BulkTransitionResult, Quota } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { WalkthroughDialog, type WalkthroughTarget } from "@/components/deliveries/walkthrough-dialog";
import { bulkDeliveries } from "@/components/steps/deliveries-api";
import { failedDetails, itemStepName, participationDetails, stepGroupDetails } from "./attention-meta";

const T = {
  sendNow: (manual: boolean) => (manual ? "Prepare now" : "Send now"),
  sendNowTitle: (name: string, manual: boolean) => `${manual ? "Prepare now" : "Send now"}: ${name}`,
  sendNowMessage: (n: number, manual: boolean) =>
    manual
      ? `Prepare ${pluralize(n, "past-due email")} now? Each becomes “ready to send” so you can copy it and send it from your own mail program.`
      : `Send ${pluralize(n, "past-due email")} right now?`,
  sendNowDone: (n: number, manual: boolean) =>
    manual ? `${pluralize(n, "email")} prepared. Use “Send manually” to copy and send them.` : `${pluralize(n, "email")} being sent now.`,
  skip: "Skip",
  skipTitle: (name: string) => `Skip: ${name}`,
  skipMessage: (n: number) => `Skip ${pluralize(n, "past-due email")}? They are cancelled and never sent.`,
  skipDone: (n: number) => `${pluralize(n, "email")} skipped.`,
  dismiss: "Dismiss",
  dismissTitle: (name: string) => `Dismiss failed emails: ${name}`,
  dismissMessage: (n: number) => `Dismiss ${pluralize(n, "failed email")}? They are marked as skipped, are not retried and leave the work queue.`,
  dismissDone: (n: number) => `${pluralize(n, "failed email")} dismissed.`,
  resend: (manual: boolean) => (manual ? "Retry manually" : "Resend"),
  resendTitle: (name: string) => `Resend failed emails: ${name}`,
  resendMessage: (n: number, manual: boolean) =>
    manual ? `Make ${pluralize(n, "failed email")} ready to send manually again?` : `Queue ${pluralize(n, "failed email")} for sending again?`,
  resendDone: (n: number) => `${pluralize(n, "email")} queued again.`,
  resumed: "Sending resumed.",
  advanceTitle: (label: string) => `Advance all to “${label}”`,
  advanceMessage: (label: string, teams: string) => `Mark “${label}” as reached for: ${teams}?`,
  advanceLabel: "Advance all",
  advanced: (ok: number, total: number) => `${ok} of ${pluralize(total, "team")} advanced.`,
  advanceFailed: (ok: number, failed: string) => `${ok} advanced. Not possible for: ${failed}`,
  partial: (ok: number, failed: number) => `${ok} done, ${failed} not possible. See the item for details.`,
  walkTitle: (tournament: string) => `Send manually: ${tournament}`,
  unknown: "error",
};

export type PendingKind = "send-now" | "skip" | "dismiss" | "resend" | "advance-all";

/** Per-item results of a bulk action that did not succeed (shown on the item). */
export interface ItemFailure {
  label: string;
  error: string;
}

export interface AttentionActions {
  manual: boolean;
  /** Id of the item whose action is running. */
  busyId: string | null;
  /** Failed parts of the last bulk action per item (e.g. emails blocked by missing variables). */
  failures: Record<string, ItemFailure[]>;
  confirm: (kind: PendingKind, item: AttentionItem) => void;
  resume: (item: AttentionItem) => void;
  /** Manual walk-through over the tournament's READY deliveries. */
  openWalkthrough: (item: AttentionItem) => void;
}

/** Ids the bulk action of an item works on (steps for PAST_DUE, deliveries for FAILED_DELIVERIES). */
function targetIds(kind: PendingKind, item: AttentionItem): string[] {
  if (kind === "send-now" || kind === "skip") return stepGroupDetails(item)?.stepIds ?? [];
  if (kind === "dismiss" || kind === "resend") return failedDetails(item)?.deliveryIds ?? [];
  return participationDetails(item)?.participations.map((p) => p.id) ?? [];
}

/** Label of the i-th target: the team at the same position in `details.teams`, when the lists line up. */
function labelsOf(item: AttentionItem, ids: string[]): Map<string, string> {
  const teams = stepGroupDetails(item)?.teams ?? failedDetails(item)?.teams ?? [];
  return new Map(ids.map((id, i) => [id, teams.length === ids.length ? teams[i] : id]));
}

/** Runs the inline actions of work-queue items and renders their dialogs. Refetches the queue afterwards. */
export function useAttentionActions(onChanged?: () => void) {
  const toast = useToast();
  const attention = useAttention();
  const manual = useManualMode();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, ItemFailure[]>>({});
  const [pending, setPending] = useState<{ kind: PendingKind; item: AttentionItem } | null>(null);
  const [walkthrough, setWalkthrough] = useState<WalkthroughTarget | null>(null);

  function changed() {
    attention.reload();
    onChanged?.();
  }

  async function advanceAll(item: AttentionItem) {
    const details = participationDetails(item);
    if (!details) return;
    const { results } = await api.post<BulkTransitionResult>("/participations/transition", { ids: targetIds("advance-all", item), to: details.status });
    const names = new Map(details.participations.map((p) => [p.id, p.teamName]));
    const failed = results.filter((r) => !r.ok);
    const ok = results.length - failed.length;
    if (failed.length === 0) toast.show(T.advanced(ok, results.length));
    else toast.show(T.advanceFailed(ok, failed.map((r) => `${names.get(r.id) ?? r.id} (${r.error ?? T.unknown})`).join(", ")), "error");
    changed();
  }

  function report(kind: PendingKind, item: AttentionItem, ids: string[], { results }: BulkActionResult) {
    const labels = labelsOf(item, ids);
    const failed = results.filter((r) => !r.ok);
    const ok = results.length - failed.length;
    setFailures((f) => ({ ...f, [item.id]: failed.map((r) => ({ label: labels.get(r.id) ?? r.id, error: r.error ?? T.unknown })) }));
    if (failed.length > 0) toast.show(T.partial(ok, failed.length), "error");
    else if (kind === "send-now") toast.show(T.sendNowDone(ok, manual));
    else if (kind === "skip") toast.show(T.skipDone(ok));
    else if (kind === "dismiss") toast.show(T.dismissDone(ok));
    else toast.show(T.resendDone(ok));
  }

  async function execute(kind: PendingKind, item: AttentionItem) {
    if (kind === "advance-all") return advanceAll(item);
    const ids = targetIds(kind, item);
    if (ids.length === 0) return;
    const result =
      kind === "send-now" || kind === "skip"
        ? await api.post<BulkActionResult>("/steps/bulk", { ids, action: kind })
        : await bulkDeliveries(ids, kind);
    report(kind, item, ids, result);
    changed();
  }

  async function resume(item: AttentionItem) {
    setBusyId(item.id);
    try {
      await api.post<Quota>("/deliveries/resume");
      toast.show(T.resumed);
      changed();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  const item = pending?.item;
  const name = item ? (itemStepName(item) ?? item.tournament?.name ?? item.title) : "";
  const count = pending ? targetIds(pending.kind, pending.item).length : 0;
  const pendingDetails = item ? participationDetails(item) : null;
  const advanceLabel = pendingDetails?.label ?? "";
  const advanceTeams = pendingDetails?.participations.map((p) => p.teamName).join(", ") ?? "";
  const confirmText: Record<PendingKind, { title: string; message: string; label: string }> = {
    "send-now": { title: T.sendNowTitle(name, manual), message: T.sendNowMessage(count, manual), label: T.sendNow(manual) },
    skip: { title: T.skipTitle(name), message: T.skipMessage(count), label: T.skip },
    dismiss: { title: T.dismissTitle(name), message: T.dismissMessage(count), label: T.dismiss },
    resend: { title: T.resendTitle(name), message: T.resendMessage(count, manual), label: T.resend(manual) },
    "advance-all": { title: T.advanceTitle(advanceLabel), message: T.advanceMessage(advanceLabel, advanceTeams), label: T.advanceLabel },
  };
  const info = pending ? confirmText[pending.kind] : null;

  const dialogs = (
    <>
      <ConfirmDialog
        open={pending !== null}
        title={info?.title ?? ""}
        message={info?.message ?? ""}
        confirmLabel={info?.label}
        danger={pending?.kind === "skip" || pending?.kind === "dismiss"}
        onConfirm={() => (pending ? execute(pending.kind, pending.item) : undefined)}
        onClose={() => setPending(null)}
      />
      <WalkthroughDialog target={walkthrough} onClose={() => setWalkthrough(null)} onChanged={changed} />
    </>
  );

  const actions: AttentionActions = {
    manual,
    busyId,
    failures,
    confirm: (kind, target) => setPending({ kind, item: target }),
    resume: (target) => void resume(target),
    openWalkthrough: (target) => {
      if (!target.tournament) return;
      setWalkthrough({ scope: { filters: { tournament: [target.tournament.id] } }, title: T.walkTitle(target.tournament.name) });
    },
  };

  return { actions, dialogs };
}
