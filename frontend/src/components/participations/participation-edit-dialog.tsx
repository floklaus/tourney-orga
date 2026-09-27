"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { isConflict } from "@/lib/errors";
import { useApi } from "@/lib/use-api";
import type { Participation, Tournament } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { DayPicker } from "./day-picker";

const T = {
  title: (team: string) => `Edit ${team}`,
  description: (tournament: string) => `Participation in ${tournament}`,
  ageGroup: "Age group",
  choose: "Choose…",
  none: "None",
  loadingAgeGroups: "Loading age groups…",
  required: "This tournament has age groups, so choose one.",
  notes: "Notes",
  cancel: "Cancel",
  save: "Save",
  stale: "Someone changed this participation in the meantime. Close the dialog and try again with the refreshed data.",
};

interface Props {
  participation: Participation | null;
  onClose: () => void;
  onSaved: (updated: Participation) => void;
  onStale: () => void;
}

export function ParticipationEditDialog({ participation, onClose, onSaved, onStale }: Props) {
  return (
    <Dialog
      open={participation !== null}
      onClose={onClose}
      title={T.title(participation?.team.name ?? "")}
      description={participation ? T.description(participation.tournament.name) : undefined}
    >
      {participation && <EditForm participation={participation} onClose={onClose} onSaved={onSaved} onStale={onStale} />}
    </Dialog>
  );
}

function EditForm({ participation: p, onClose, onSaved, onStale }: Omit<Props, "participation"> & { participation: Participation }) {
  const tournament = useApi(`tournament:${p.tournament.id}`, () => api.get<Tournament>(`/tournaments/${p.tournament.id}`));
  const ageGroups = tournament.data?.ageGroups ?? [];
  const [ageGroup, setAgeGroup] = useState(p.ageGroup ?? "");
  const [days, setDays] = useState(p.days);
  const [notes, setNotes] = useState(p.notes ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [stale, setStale] = useState(false);
  const ageGroupError = submitted && ageGroups.length > 0 && !ageGroup ? T.required : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if ((ageGroups.length > 0 && !ageGroup) || days.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Participation>(`/participations/${p.id}`, {
        version: p.version,
        ageGroup: ageGroup || null,
        days,
        notes: notes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setBusy(false);
      if (isConflict(err)) {
        setStale(true);
        onStale();
      } else {
        setError(err);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {stale && <Alert tone="warning">{T.stale}</Alert>}
      <ErrorAlert error={error} />
      {tournament.error && <ErrorAlert error={tournament.error} />}
      <SelectField
        label={T.ageGroup}
        value={ageGroup}
        onChange={(e) => setAgeGroup(e.target.value)}
        disabled={!tournament.data}
        error={ageGroupError}
        hint={tournament.data ? undefined : T.loadingAgeGroups}
        required={ageGroups.length > 0}
      >
        <option value="">{ageGroups.length > 0 ? T.choose : T.none}</option>
        {/* Keep a value that is no longer offered by the tournament selectable. */}
        {[...ageGroups, ...(p.ageGroup && !ageGroups.includes(p.ageGroup) ? [p.ageGroup] : [])].map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </SelectField>
      <DayPicker startDate={p.tournament.startDate} endDate={p.tournament.endDate} value={days} onChange={setDays} showError={submitted} />
      <TextAreaField label={T.notes} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button type="submit" loading={busy} disabled={stale}>
          {T.save}
        </Button>
      </div>
    </form>
  );
}
