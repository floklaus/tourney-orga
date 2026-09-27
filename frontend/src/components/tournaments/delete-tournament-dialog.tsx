"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isConflict } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";

const T = {
  title: "Delete tournament",
  message: (name: string) => `Delete “${name}”? Its email plan and variables are deleted too.`,
  cancel: "Cancel",
  delete: "Delete tournament",
  forceTitle: "This tournament has participations",
  forceMessage: (n: number) =>
    `${pluralize(n, "team")} (plus any withdrawn ones) take part in it. Deleting it also deletes all participations, their status history and their planned emails. This cannot be undone.`,
  confirmLabel: (name: string) => `Type “${name}” to confirm`,
  force: "Delete tournament and participations",
};

interface Props {
  tournament: Tournament | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTournamentDialog({ tournament, onClose, onDeleted }: Props) {
  return (
    <Dialog open={tournament !== null} onClose={onClose} title={T.title} size="sm">
      {tournament && <DeleteBody tournament={tournament} onClose={onClose} onDeleted={onDeleted} />}
    </Dialog>
  );
}

/** Plain delete first; a 409 (has participations) switches to a typed-name confirmation for ?force=true. */
function DeleteBody({ tournament, onClose, onDeleted }: Omit<Props, "tournament"> & { tournament: Tournament }) {
  const [needsForce, setNeedsForce] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const confirmed = typed.trim() === tournament.name.trim();

  async function remove(force: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/tournaments/${tournament.id}${force ? "?force=true" : ""}`);
      onDeleted();
    } catch (err) {
      setBusy(false);
      if (!force && isConflict(err)) setNeedsForce(true);
      else setError(err);
    }
  }

  return (
    <div className="space-y-4">
      {!needsForce ? (
        <p className="text-sm text-slate-700">{T.message(tournament.name)}</p>
      ) : (
        <>
          <Alert tone="warning" title={T.forceTitle}>
            {T.forceMessage(tournament.participantCount)}
          </Alert>
          <TextField label={T.confirmLabel(tournament.name)} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </>
      )}
      <ErrorAlert error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        {needsForce ? (
          <Button variant="danger" onClick={() => remove(true)} loading={busy} disabled={!confirmed}>
            {T.force}
          </Button>
        ) : (
          <Button variant="danger" onClick={() => remove(false)} loading={busy}>
            {T.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
