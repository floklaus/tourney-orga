"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { useListQuery, type ListFilters } from "@/lib/list-query";
import { useAttention, useManualMode, useTimeZone } from "@/lib/queries";
import { useListData } from "@/lib/use-list-data";
import type { Delivery, DeliveryBulkAction } from "@/lib/types";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { bulkDeliveries } from "@/components/steps/deliveries-api";
import { deliveryColumns, type RowAction } from "@/components/steps/deliveries-table";
import { WalkthroughDialog, type WalkthroughTarget } from "./walkthrough-dialog";

const T = {
  title: "Emails",
  description:
    "Every email prepared or sent to a team, across all tournaments. Filter e.g. by “Ready to send” and a tournament, then walk through the emails to send them from your own mail program.",
  caption: "Deliveries",
  searchPlaceholder: "Team, email or email name",
  walkthrough: (n: number) => `Start walk-through (${n})`,
  walkthroughHint: "Ready-to-send emails matching the current search and filters.",
  empty: "No emails yet",
  emptyHint: "Emails appear here once they are due (or prepared with “Send now” / “Prepare now”).",
  dismiss: (n: number) => `Dismiss failed (${n})`,
  resend: (n: number) => `Resend failed (${n})`,
  noFailed: "Only failed emails can be dismissed or resent.",
  dismissTitle: "Dismiss failed emails",
  dismissMessage: (n: number) => `Dismiss ${pluralize(n, "failed email")}? They are marked as skipped, are not retried and leave the work queue.`,
  resendTitle: "Resend failed emails",
  resendMessage: (n: number, manual: boolean) =>
    manual
      ? `Make ${pluralize(n, "failed email")} ready to send manually again?`
      : `Queue ${pluralize(n, "failed email")} for sending again?`,
  bulkDone: (ok: number, action: DeliveryBulkAction) => `${pluralize(ok, "email")} ${action === "dismiss" ? "dismissed" : "queued again"}.`,
  bulkFailed: (ok: number, failed: string) => `${ok} done. Not possible for: ${failed}`,
  deletedTeam: "deleted team",
  resendQueued: (name: string) => `Resend queued for ${name}.`,
  resendReady: (name: string) => `${name} is ready to send manually.`,
  marked: (name: string) => `Marked as sent: ${name}.`,
  undone: (name: string) => `${name} is ready to send again.`,
  walkTitle: "Send emails manually",
};

/** Status is replaced by READY for the walk-through; everything else of the current query applies. */
function walkthroughFilters(filters: ListFilters): ListFilters {
  return Object.fromEntries(Object.entries(filters).filter(([key]) => key !== "status"));
}

export function DeliveriesPage() {
  const toast = useToast();
  const timeZone = useTimeZone();
  const manual = useManualMode();
  const attention = useAttention();
  const list = useListQuery();
  const deliveries = useListData<Delivery>("/deliveries", list);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [walkthrough, setWalkthrough] = useState<WalkthroughTarget | null>(null);
  const [bulk, setBulk] = useState<{ action: DeliveryBulkAction; rows: Delivery[]; clear: () => void } | null>(null);
  const scope = { filters: walkthroughFilters(list.query.filters), search: list.query.search };
  const statusFacet = deliveries.data?.meta.facets?.find((f) => f.key === "status");
  const readyCount = statusFacet?.options.find((o) => o.value === "READY")?.count ?? 0;

  function refresh() {
    deliveries.reload();
    attention.reload();
  }

  async function runRowRequest(delivery: Delivery, path: string, success: string) {
    setBusyId(delivery.id);
    try {
      await api.post<Delivery>(`/deliveries/${delivery.id}/${path}`);
      toast.show(success);
      refresh();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleRowAction(action: RowAction, delivery: Delivery) {
    const name = delivery.team?.name ?? T.deletedTeam;
    if (action === "send-manually" || action === "view") setWalkthrough({ scope, title: T.walkTitle, start: delivery });
    else if (action === "mark-sent") void runRowRequest(delivery, "mark-sent", T.marked(name));
    else if (action === "undo") void runRowRequest(delivery, "mark-unsent", T.undone(name));
    else void runRowRequest(delivery, "resend", manual ? T.resendReady(name) : T.resendQueued(name));
  }

  async function runBulk(action: DeliveryBulkAction, rows: Delivery[], clear: () => void) {
    const { results } = await bulkDeliveries(rows.map((d) => d.id), action);
    const names = new Map(rows.map((d) => [d.id, d.team?.name ?? T.deletedTeam]));
    const failed = results.filter((r) => !r.ok);
    const ok = results.length - failed.length;
    if (failed.length === 0) toast.show(T.bulkDone(ok, action));
    else toast.show(T.bulkFailed(ok, failed.map((r) => `${names.get(r.id) ?? r.id} (${r.error ?? "error"})`).join(", ")), "error");
    clear();
    refresh();
  }

  const walkButton = (
    <Button onClick={() => setWalkthrough({ scope, title: T.walkTitle })} disabled={readyCount === 0} title={T.walkthroughHint}>
      {T.walkthrough(readyCount)}
    </Button>
  );

  return (
    <>
      <PageHeader title={T.title} description={T.description} />
      <DataTable
        caption={T.caption}
        columns={deliveryColumns(timeZone, { manual, busyId, onAction: handleRowAction })}
        list={list}
        result={deliveries}
        rowKey={(d) => d.id}
        rowLabel={(d) => `${d.team?.name ?? T.deletedTeam}: ${d.step?.name ?? d.renderedSubject}`}
        searchPlaceholder={T.searchPlaceholder}
        toolbarActions={walkButton}
        emptyTitle={T.empty}
        emptyDescription={T.emptyHint}
        bulkActions={(selected, clear) => {
          const failed = selected.filter((d) => d.status === "FAILED");
          return (
            <>
              <Button size="sm" variant="secondary" disabled={failed.length === 0} title={failed.length === 0 ? T.noFailed : undefined} onClick={() => setBulk({ action: "resend", rows: failed, clear })}>
                {T.resend(failed.length)}
              </Button>
              <Button size="sm" variant="danger-outline" disabled={failed.length === 0} title={failed.length === 0 ? T.noFailed : undefined} onClick={() => setBulk({ action: "dismiss", rows: failed, clear })}>
                {T.dismiss(failed.length)}
              </Button>
            </>
          );
        }}
      />
      <ConfirmDialog
        open={bulk !== null}
        title={bulk?.action === "dismiss" ? T.dismissTitle : T.resendTitle}
        message={bulk ? (bulk.action === "dismiss" ? T.dismissMessage(bulk.rows.length) : T.resendMessage(bulk.rows.length, manual)) : ""}
        confirmLabel={bulk ? (bulk.action === "dismiss" ? T.dismiss(bulk.rows.length) : T.resend(bulk.rows.length)) : undefined}
        danger={bulk?.action === "dismiss"}
        onConfirm={() => (bulk ? runBulk(bulk.action, bulk.rows, bulk.clear) : undefined)}
        onClose={() => setBulk(null)}
      />
      <WalkthroughDialog target={walkthrough} onClose={() => setWalkthrough(null)} onChanged={refresh} />
    </>
  );
}
