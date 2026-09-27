"use client";

import { useState, type FormEvent } from "react";
import { matchAgeGroup } from "@/lib/age-group";
import { api } from "@/lib/api";
import { daysBetween, formatDayRange } from "@/lib/days";
import { MAX_LIMIT, filterParam } from "@/lib/list-query";
import { useSettings, useTournamentOptions } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import type { Participation, Team } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/states";
import { DayPicker } from "@/components/participations/day-picker";

const T = {
  title: (team: string) => `Add ${team} to a tournament`,
  description: "The team starts with status “Signed up” and receives a copy of the tournament’s email plan.",
  tournament: "Tournament",
  choose: "Choose…",
  noneLeft: "This team already takes part in every tournament.",
  tournamentRequired: "Choose a tournament.",
  ageGroup: "Age group",
  ageGroupRequired: "This tournament has age groups, so choose one.",
  noAgeGroups: "This tournament has no age groups.",
  calculated: (year: number) => `Calculated from the class of ${year}.`,
  noMatch: (year: number) => `No age group fits the class of ${year}; choose one.`,
  notes: "Notes (optional)",
  cancel: "Cancel",
  add: "Add to tournament",
  errorTitle: "Could not add the team",
};

interface Props {
  open: boolean;
  team: Team;
  onClose: () => void;
  onAdded: (participation: Participation) => void;
}

export function AddToTournamentDialog({ open, team, onClose, onAdded }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={T.title(team.name)} description={T.description}>
      <AddForm team={team} onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}

function AddForm({ team, onClose, onAdded }: Omit<Props, "open">) {
  const tournaments = useTournamentOptions();
  const taken = useApi(`team-tournaments:${team.id}`, async () => {
    const rows = await api.get<Participation[]>("/participations", { [filterParam("team")]: team.id, limit: MAX_LIMIT });
    return new Set(rows.map((p) => p.tournament.id));
  });
  const seasonStartMonth = useSettings().data?.seasonStartMonth ?? 9;
  const [tournamentId, setTournamentId] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (tournaments.error || taken.error) return <ErrorAlert error={tournaments.error ?? taken.error} />;
  if (!tournaments.data || !taken.data) return <LoadingState />;

  const takenIds = taken.data;
  const options = tournaments.data.filter((t) => !takenIds.has(t.id));
  const selected = options.find((t) => t.id === tournamentId);
  const ageGroups = selected?.ageGroups ?? [];
  const tournamentError = submitted && !selected ? T.tournamentRequired : undefined;
  const ageGroupError = submitted && ageGroups.length > 0 && !ageGroup ? T.ageGroupRequired : undefined;
  const calculated = selected ? matchAgeGroup(team.graduationYear, seasonStartMonth, selected.startDate, ageGroups) : null;
  const ageGroupHint =
    !selected || team.graduationYear === null
      ? undefined
      : ageGroups.length === 0
        ? T.noAgeGroups
        : calculated
          ? ageGroup === calculated
            ? T.calculated(team.graduationYear)
            : undefined
          : T.noMatch(team.graduationYear);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!selected || (ageGroups.length > 0 && !ageGroup) || days.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<Participation>("/participations", {
        tournamentId: selected.id,
        teamId: team.id,
        ...(ageGroup ? { ageGroup } : {}),
        days,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onAdded(created);
    } catch (err) {
      // 409: already in the tournament; 422: e.g. an age group the tournament does not offer.
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorAlert error={error} title={T.errorTitle} />
      <SelectField
        label={T.tournament}
        required
        value={tournamentId}
        onChange={(e) => {
          const next = options.find((t) => t.id === e.target.value);
          setTournamentId(e.target.value);
          setDays(next ? daysBetween(next.startDate, next.endDate) : []);
          const match = next ? matchAgeGroup(team.graduationYear, seasonStartMonth, next.startDate, next.ageGroups) : null;
          setAgeGroup(match ?? (next?.ageGroups.length === 1 ? next.ageGroups[0] : ""));
        }}
        error={tournamentError}
        hint={options.length === 0 ? T.noneLeft : undefined}
        disabled={options.length === 0}
      >
        <option value="">{T.choose}</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({formatDayRange(t.startDate, t.endDate)})
          </option>
        ))}
      </SelectField>
      <SelectField
        label={T.ageGroup}
        required={ageGroups.length > 0}
        value={ageGroup}
        onChange={(e) => setAgeGroup(e.target.value)}
        disabled={ageGroups.length === 0}
        hint={selected && ageGroups.length === 0 ? T.noAgeGroups : ageGroupHint}
        error={ageGroupError}
      >
        <option value="">{T.choose}</option>
        {ageGroups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </SelectField>
      {selected && <DayPicker startDate={selected.startDate} endDate={selected.endDate} value={days} onChange={setDays} showError={submitted} />}
      <TextAreaField label={T.notes} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button type="submit" loading={busy} disabled={options.length === 0}>
          {T.add}
        </Button>
      </div>
    </form>
  );
}
