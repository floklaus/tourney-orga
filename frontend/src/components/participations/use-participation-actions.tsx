"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, isConflict } from "@/lib/errors";
import { allowedFromConflict, statusLabel } from "@/lib/participation";
import { useAttention, useTimeZone } from "@/lib/queries";
import type { Participation, ParticipationStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { BulkTransitionDialog } from "./bulk-transition-dialog";
import { ParticipationEditDialog } from "./participation-edit-dialog";
import { TransitionDialog, type TransitionTarget } from "./transition-dialog";

const T = {
  advanced: (team: string, label: string) => `${team}: ${label}.`,
  notAllowed: (allowed: string) => `This change is not allowed any more (allowed now: ${allowed || "none"}). The list was refreshed.`,
  stale: "Someone changed this participation in the meantime. The list was refreshed.",
  saved: (team: string) => `${team} saved.`,
  deleteTitle: "Remove participation",
  deleteMessage: (team: string, tournament: string) =>
    `Remove ${team} from ${tournament}? Its status history and planned emails are deleted too. To keep the history, withdraw the team instead.`,
  deleteLabel: "Remove",
  deleted: (team: string) => `${team} removed from the tournament.`,
};

export interface ParticipationActions {
  busyId: string | null;
  /** Moves to `nextStatus` right away. */
  advance: (p: Participation) => void;
  /** Opens the confirmation (with optional note) for any target status. */
  changeStatus: (p: Participation, to: ParticipationStatus) => void;
  edit: (p: Participation) => void;
  remove: (p: Participation) => void;
  /** Navigates to the participation page. */
  open: (p: Pick<Participation, "id">) => void;
  bulk: (rows: Participation[], clearSelection: () => void) => void;
}

/**
 * Row, bulk and detail actions of participations, plus their dialogs. Calls `onChanged` after every
 * change, and `onRemoved` (instead) after a participation was deleted, if given.
 */
export function useParticipationActions(onChanged: () => void, onRemoved?: () => void) {
  const router = useRouter();
  const toast = useToast();
  const attention = useAttention();
  const timeZone = useTimeZone();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transition, setTransition] = useState<TransitionTarget | null>(null);
  const [editing, setEditing] = useState<Participation | null>(null);
  const [deleting, setDeleting] = useState<Participation | null>(null);
  const [bulk, setBulk] = useState<{ rows: Participation[]; clear: () => void } | null>(null);

  function changed() {
    onChanged();
    attention.reload();
  }

  async function advance(p: Participation) {
    if (!p.nextStatus) return;
    const to = p.nextStatus;
    setBusyId(p.id);
    try {
      await api.post<Participation>(`/participations/${p.id}/transition`, { to, version: p.version });
      toast.show(T.advanced(p.team.name, statusLabel(to, p)));
      changed();
    } catch (err) {
      const allowed = allowedFromConflict(err);
      if (allowed) toast.show(T.notAllowed(allowed.map((s) => statusLabel(s, p)).join(", ")), "error");
      else toast.show(isConflict(err) ? T.stale : errorMessage(err), "error");
      if (isConflict(err)) onChanged();
    } finally {
      setBusyId(null);
    }
  }

  const actions: ParticipationActions = {
    busyId,
    advance: (p) => void advance(p),
    changeStatus: (participation, to) => setTransition({ participation, to }),
    edit: setEditing,
    remove: setDeleting,
    open: (p) => router.push(`/participations/${p.id}`),
    bulk: (rows, clear) => setBulk({ rows, clear }),
  };

  const dialogs = (
    <>
      <TransitionDialog
        target={transition}
        onClose={() => setTransition(null)}
        onStale={onChanged}
        onDone={(updated) => {
          setTransition(null);
          toast.show(T.advanced(updated.team.name, statusLabel(updated.status, updated)));
          changed();
        }}
      />
      <ParticipationEditDialog
        participation={editing}
        onClose={() => setEditing(null)}
        onStale={onChanged}
        onSaved={(updated) => {
          setEditing(null);
          toast.show(T.saved(updated.team.name));
          changed();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={T.deleteTitle}
        danger
        confirmLabel={T.deleteLabel}
        message={<p>{deleting ? T.deleteMessage(deleting.team.name, deleting.tournament.name) : ""}</p>}
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/participations/${deleting.id}`);
          toast.show(T.deleted(deleting.team.name));
          attention.reload();
          if (onRemoved) onRemoved();
          else onChanged();
        }}
        onClose={() => setDeleting(null)}
      />
      <BulkTransitionDialog
        selection={bulk?.rows ?? null}
        onClose={() => setBulk(null)}
        onApplied={(okIds) => {
          if (okIds.length > 0) {
            bulk?.clear();
            changed();
          }
        }}
      />
    </>
  );

  return { actions, dialogs, timeZone };
}
