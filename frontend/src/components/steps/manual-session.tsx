"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, missingVariablesOf } from "@/lib/errors";
import { useApi } from "@/lib/use-api";
import type { Delivery, ManualMessage } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { DeliveryStatusBadge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { MissingVariablesNotice } from "@/components/variables/missing-variables-notice";
import { ManualMessagePanel } from "./manual-message-panel";

const T = {
  back: "← Back",
  heading: "Manual message",
  progress: (position: number, total: number) => `${position} of ${total}`,
  markSent: "Mark as sent",
  markSentNext: "Mark as sent & next",
  undo: "Undo “sent”",
  markFailed: "Could not mark the email as sent",
  undoFailed: "Could not undo",
  marked: (name: string) => `Marked as sent: ${name}.`,
  allDone: "All ready emails are marked as sent.",
  nextFailed: "Marked as sent, but the next email could not be loaded.",
  undone: (name: string) => `${name} is ready to send again.`,
  deletedTeam: "Deleted team",
  context: (step: string | undefined, tournament: string | undefined) => [step, tournament].filter(Boolean).join(" · "),
};

/** The fields of a delivery the walk-through needs (GET /deliveries rows satisfy it). */
export type SessionDelivery = Pick<Delivery, "id" | "status" | "team"> &
  Partial<Pick<Delivery, "tournament" | "participationId" | "step">>;

interface Props {
  /** Delivery the organizer opened (READY, FAILED or a manually sent one). */
  start: SessionDelivery;
  /** READY deliveries of the scope when the session started, in list order. */
  ready: SessionDelivery[];
  /** Reloads the READY deliveries of the same scope (after each "mark as sent & next"). */
  loadReady: () => Promise<SessionDelivery[]>;
  onExit: () => void;
  onChanged: () => void;
  /** Closes the surrounding dialog (used when following a "fill in variables" link). */
  onLeave?: () => void;
  backLabel?: string;
}

/** Next READY delivery after `currentId`, keeping the previous order and using fresh data. */
function pickNext(previous: SessionDelivery[], fresh: SessionDelivery[], currentId: string): SessionDelivery | null {
  const byId = new Map(fresh.filter((d) => d.id !== currentId).map((d) => [d.id, d]));
  const index = previous.findIndex((d) => d.id === currentId);
  const after = index >= 0 ? previous.slice(index + 1) : previous;
  const next = after.find((d) => byId.has(d.id));
  return (next && byId.get(next.id)) ?? byId.values().next().value ?? null;
}

type Busy = "sent" | "next" | "undo" | null;

/** Walks the organizer through READY deliveries (any GET /deliveries scope): copy, send yourself, mark as sent. */
export function ManualSession({ start, ready, loadReady, onExit, onChanged, onLeave, backLabel = T.back }: Props) {
  const toast = useToast();
  const [current, setCurrent] = useState(start);
  const [remaining, setRemaining] = useState(ready);
  const [doneCount, setDoneCount] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ title: string; error: unknown } | null>(null);
  const [markMissing, setMarkMissing] = useState<string[] | null>(null);
  const message = useApi(`manual-message:${current.id}`, () => api.get<ManualMessage>(`/deliveries/${current.id}/message`));
  const loaded = message.data?.deliveryId === current.id ? message.data : undefined;

  const name = current.team?.name ?? T.deletedTeam;
  const status = loaded?.status ?? current.status;
  // 422 {missingVariables}: the email cannot be copied or marked as sent until the values exist.
  const missingVars = missingVariablesOf(message.error) ?? markMissing;
  const canMark = (status === "READY" || status === "FAILED") && !missingVars;
  const isSent = status === "SENT";
  const inQueue = remaining.some((d) => d.id === current.id);
  const total = doneCount + remaining.length + (inQueue ? 0 : 1);
  const hasNext = remaining.some((d) => d.id !== current.id);
  const blocked = busy !== null || !loaded;

  async function advance() {
    try {
      const fresh = await loadReady();
      const next = pickNext(remaining, fresh, current.id);
      if (!next) {
        toast.show(T.allDone);
        onExit();
        return;
      }
      setDoneCount((c) => c + 1);
      setMarkMissing(null);
      setRemaining(fresh);
      setCurrent(next);
      setBusy(null);
    } catch (err) {
      toast.show(`${T.nextFailed} ${errorMessage(err)}`, "error");
      onExit();
    }
  }

  async function markSent(andNext: boolean) {
    if (blocked || !canMark) return;
    setBusy(andNext ? "next" : "sent");
    setError(null);
    try {
      await api.post<Delivery>(`/deliveries/${current.id}/mark-sent`);
    } catch (err) {
      const missing = missingVariablesOf(err);
      if (missing) setMarkMissing(missing);
      else setError({ title: T.markFailed, error: err });
      setBusy(null);
      return;
    }
    onChanged();
    if (andNext) {
      await advance();
      return;
    }
    toast.show(T.marked(name));
    onExit();
  }

  async function undo() {
    if (blocked) return;
    setBusy("undo");
    setError(null);
    try {
      await api.post<Delivery>(`/deliveries/${current.id}/mark-unsent`);
      toast.show(T.undone(name));
      onChanged();
      onExit();
    } catch (err) {
      setError({ title: T.undoFailed, error: err });
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          {backLabel}
        </Button>
        {canMark && (
          <p role="status" className="text-sm font-medium text-slate-800">
            {T.progress(Math.min(doneCount + 1, total), total)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {T.heading}: {name}
        </h3>
        <DeliveryStatusBadge status={status} />
        {message.loading && <Spinner className="text-slate-500" />}
      </div>
      {(current.step || current.tournament) && (
        <p className="-mt-2 text-sm text-slate-700">{T.context(current.step?.name, current.tournament?.name)}</p>
      )}

      {missingVars ? (
        <MissingVariablesNotice
          keys={missingVars}
          tournamentId={current.tournament?.id}
          participationId={current.participationId}
          onNavigate={onLeave}
        />
      ) : (
        <QueryView data={loaded} error={message.error} loading={message.loading || !loaded} onRetry={message.reload}>
          {(data) => <ManualMessagePanel message={data} />}
        </QueryView>
      )}

      {error && <ErrorAlert error={error.error} title={error.title} />}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-1 pb-1 pt-4">
        {isSent && (
          <Button variant="danger-outline" onClick={undo} loading={busy === "undo"} disabled={!loaded}>
            {T.undo}
          </Button>
        )}
        {canMark && (
          <Button variant={hasNext ? "secondary" : "primary"} onClick={() => markSent(false)} loading={busy === "sent"} disabled={!loaded || busy === "next"}>
            {T.markSent}
          </Button>
        )}
        {canMark && hasNext && (
          // aria-disabled instead of disabled keeps keyboard focus on this button while the next email loads.
          <Button onClick={() => markSent(true)} aria-disabled={blocked || undefined} className={blocked ? "opacity-60" : undefined}>
            {busy === "next" && <Spinner />}
            {T.markSentNext}
          </Button>
        )}
      </div>
    </div>
  );
}
