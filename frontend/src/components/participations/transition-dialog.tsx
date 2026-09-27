"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isConflict } from "@/lib/errors";
import { allowedFromConflict, statusIndex, statusLabel } from "@/lib/participation";
import type { Participation, ParticipationStatus } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/field";

const T = {
  title: (label: string) => `Change status to “${label}”`,
  message: (team: string, tournament: string, from: string, to: string) =>
    `${team} in ${tournament}: ${from} → ${to}.`,
  skipped: (n: number) => `${n} skipped ${n === 1 ? "step is" : "steps are"} recorded as completed now.`,
  withdraw: "The team leaves the tournament. You can reinstate it later.",
  back: "Undoes the last step.",
  note: "Note (optional)",
  noteHint: "Stored in the status history.",
  cancel: "Cancel",
  confirm: "Change status",
  notAllowed: (allowed: string) => `This change is not allowed (any more). Allowed now: ${allowed || "none"}.`,
  stale: "Someone changed this participation in the meantime. The list was refreshed, please try again.",
};

export interface TransitionTarget {
  participation: Participation;
  to: ParticipationStatus;
}

interface Props {
  target: TransitionTarget | null;
  onClose: () => void;
  onDone: (updated: Participation) => void;
  /** Called when the server says the data is outdated (409), so the caller can reload. */
  onStale: () => void;
}

export function TransitionDialog({ target, onClose, onDone, onStale }: Props) {
  const label = target ? statusLabel(target.to, target.participation) : "";
  return (
    <Dialog open={target !== null} onClose={onClose} title={T.title(label)} size="sm">
      {target && <TransitionBody target={target} onClose={onClose} onDone={onDone} onStale={onStale} />}
    </Dialog>
  );
}

function hintOf({ participation: p, to }: TransitionTarget): string | null {
  if (to === "WITHDRAWN") return T.withdraw;
  const from = statusIndex(p.status);
  const next = statusIndex(to);
  if (from >= 0 && next === from - 1) return T.back;
  if (from >= 0 && next > from + 1) return T.skipped(next - from - 1);
  return null;
}

function TransitionBody({ target, onClose, onDone, onStale }: Omit<Props, "target"> & { target: TransitionTarget }) {
  const { participation: p, to } = target;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const hint = hintOf(target);

  async function submit() {
    setBusy(true);
    setError(null);
    setConflict(null);
    try {
      const updated = await api.post<Participation>(`/participations/${p.id}/transition`, {
        to,
        version: p.version,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onDone(updated);
    } catch (err) {
      setBusy(false);
      const allowed = allowedFromConflict(err);
      if (allowed) setConflict(T.notAllowed(allowed.map((s) => statusLabel(s, p)).join(", ")));
      else if (isConflict(err)) setConflict(T.stale);
      else setError(err);
      if (isConflict(err)) onStale();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-800">{T.message(p.team.name, p.tournament.name, statusLabel(p.status, p), statusLabel(to, p))}</p>
      {hint && <p className="text-sm text-slate-700">{hint}</p>}
      <TextAreaField label={T.note} hint={T.noteHint} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {conflict && <Alert tone="warning">{conflict}</Alert>}
      <ErrorAlert error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button variant={to === "WITHDRAWN" ? "danger" : "primary"} onClick={submit} loading={busy} disabled={conflict !== null}>
          {T.confirm}
        </Button>
      </div>
    </div>
  );
}
