"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/participation";
import type { BulkTransitionResult, Participation, ParticipationStatus } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField } from "@/components/ui/field";

const T = {
  title: (n: number) => `Change status of ${pluralize(n, "participation")}`,
  target: "New status",
  targetHint: "Each row moves only if the change is allowed from its current status (forward to any later step, back one step, withdraw or reinstate).",
  note: "Note (optional)",
  cancel: "Cancel",
  submit: "Apply",
  done: "Done",
  succeeded: (n: number) => `${pluralize(n, "participation")} updated.`,
  failedTitle: (n: number) => `${pluralize(n, "participation")} could not be changed`,
  unknownTeam: "Unknown team",
};

interface Props {
  /** The selected rows, or null when closed. */
  selection: Participation[] | null;
  /** Preselected target, e.g. the most common next status. */
  initialTarget?: ParticipationStatus;
  onClose: () => void;
  /** Called after the request, with the ids that changed. */
  onApplied: (okIds: string[]) => void;
}

export function BulkTransitionDialog({ selection, initialTarget, onClose, onApplied }: Props) {
  return (
    <Dialog open={selection !== null} onClose={onClose} title={T.title(selection?.length ?? 0)}>
      {selection && <BulkBody selection={selection} initialTarget={initialTarget} onClose={onClose} onApplied={onApplied} />}
    </Dialog>
  );
}

/** The most common next status of the selection (a sensible default target). */
export function commonNextStatus(rows: Participation[]): ParticipationStatus | undefined {
  const counts = new Map<ParticipationStatus, number>();
  rows.forEach((p) => p.nextStatus && counts.set(p.nextStatus, (counts.get(p.nextStatus) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function BulkBody({ selection, initialTarget, onClose, onApplied }: Omit<Props, "selection"> & { selection: Participation[] }) {
  const [to, setTo] = useState<ParticipationStatus>(initialTarget ?? commonNextStatus(selection) ?? "PAID");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<BulkTransitionResult | null>(null);
  const names = new Map(selection.map((p) => [p.id, `${p.team.name} (${p.tournament.name})`]));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<BulkTransitionResult>("/participations/transition", {
        ids: selection.map((p) => p.id),
        to,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setResult(response);
      onApplied(response.results.filter((r) => r.ok).map((r) => r.id));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const ok = result.results.filter((r) => r.ok);
    const failed = result.results.filter((r) => !r.ok);
    return (
      <div className="space-y-4">
        {ok.length > 0 && <Alert tone="success">{T.succeeded(ok.length)}</Alert>}
        {failed.length > 0 && (
          <Alert tone="warning" title={T.failedTitle(failed.length)}>
            <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">
              {failed.map((r) => (
                <li key={r.id}>
                  {names.get(r.id) ?? T.unknownTeam}: {r.error}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>{T.done}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SelectField label={T.target} value={to} onChange={(e) => setTo(e.target.value as ParticipationStatus)} hint={T.targetHint}>
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label={T.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <ErrorAlert error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button onClick={submit} loading={busy}>
          {T.submit}
        </Button>
      </div>
    </div>
  );
}
