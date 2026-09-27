"use client";

import { useState } from "react";
import { matchAgeGroup } from "@/lib/age-group";
import { daysBetween } from "@/lib/days";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { MAX_LIMIT, filterParam } from "@/lib/list-query";
import { fetchAllTeams, useSettings } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import type { BulkParticipationResult, Participation, Team, Tournament } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxList } from "@/components/ui/checkbox-list";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/states";
import { DayPicker } from "@/components/participations/day-picker";

const T = {
  title: (name: string) => `Add teams to ${name}`,
  teams: "Teams",
  teamsHint: "Teams already in this tournament are not listed. Archived teams are hidden. The tournament’s email plan is copied to each added team.",
  none: "All active teams already take part.",
  ageGroup: "Age group",
  ageGroupHint: "A chosen age group applies to all selected teams. You can change it per team later.",
  calculatedOption: "From each team’s graduation year",
  calculatedHint: "Each team gets the age group matching its graduation year. Teams without a match are skipped.",
  teamHint: (year: number, group: string | null) => `Class of ${year} → ${group ?? "no matching age group"}`,
  selectOne: "Select at least one team.",
  cancel: "Cancel",
  add: (n: number) => (n > 0 ? `Add ${pluralize(n, "team")}` : "Add teams"),
  created: (n: number) => `${pluralize(n, "team")} added (status “Signed up”).`,
  skippedTitle: (n: number) => `${pluralize(n, "team")} skipped`,
  done: "Done",
};

interface Props {
  open: boolean;
  tournament: Tournament;
  onClose: () => void;
  onAdded: () => void;
}

export function AddTeamsDialog({ open, tournament, onClose, onAdded }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={T.title(tournament.name)} size="lg">
      <AddTeamsForm tournament={tournament} onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}

async function loadCandidates(tournamentId: string) {
  const [teams, participations] = await Promise.all([
    fetchAllTeams(),
    api.get<Participation[]>("/participations", { [filterParam("tournament")]: tournamentId, limit: MAX_LIMIT }),
  ]);
  const taken = new Set(participations.map((p) => p.team.id));
  return teams.filter((t) => !taken.has(t.id));
}

type TournamentForForm = Pick<Tournament, "id" | "name" | "ageGroups" | "startDate" | "endDate">;

/** Multi-select of teams not yet in the tournament + age group -> POST /participations/bulk (shows created/skipped). */
export function AddTeamsForm({ tournament, onClose, onAdded }: { tournament: TournamentForForm; onClose: () => void; onAdded: () => void }) {
  const candidates = useApi(`add-teams:${tournament.id}`, () => loadCandidates(tournament.id));
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const seasonStartMonth = useSettings().data?.seasonStartMonth ?? 9;
  // Empty = calculated per team from its graduation year
  const [ageGroup, setAgeGroup] = useState("");
  const [days, setDays] = useState(() => daysBetween(tournament.startDate, tournament.endDate));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<BulkParticipationResult | null>(null);
  const needsAgeGroup = tournament.ageGroups.length > 0;
  const names = new Map((candidates.data ?? []).map((t) => [t.id, t.name]));

  async function submit() {
    setSubmitted(true);
    if (teamIds.length === 0 || days.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<BulkParticipationResult>("/participations/bulk", {
        tournamentId: tournament.id,
        teamIds,
        ...(ageGroup ? { ageGroup } : {}),
        days,
      });
      setResult(response);
      if (response.created.length > 0) onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function teamHint(team: Team): string | undefined {
    const parts = [
      needsAgeGroup && team.graduationYear !== null
        ? T.teamHint(team.graduationYear, matchAgeGroup(team.graduationYear, seasonStartMonth, tournament.startDate, tournament.ageGroups))
        : null,
      team.groups.map((g) => g.name).join(", "),
    ].filter(Boolean);
    return parts.join(" · ") || undefined;
  }

  if (result) {
    return (
      <div className="space-y-4">
        {result.created.length > 0 && <Alert tone="success">{T.created(result.created.length)}</Alert>}
        {result.skipped.length > 0 && (
          <Alert tone="warning" title={T.skippedTitle(result.skipped.length)}>
            <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
              {result.skipped.map((s) => (
                <li key={s.teamId}>
                  {names.get(s.teamId) ?? s.teamId}: {s.reason}
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

  if (!candidates.data) return candidates.error ? <ErrorAlert error={candidates.error} /> : <LoadingState />;

  return (
    <div className="space-y-4">
      <CheckboxList
        legend={T.teams}
        hint={T.teamsHint}
        options={candidates.data.map((t) => ({ id: t.id, name: t.name, hint: teamHint(t) }))}
        selected={teamIds}
        onChange={setTeamIds}
        searchable
        emptyText={T.none}
      />
      {submitted && teamIds.length === 0 && (
        <p role="alert" className="text-sm text-red-700">
          {T.selectOne}
        </p>
      )}
      {needsAgeGroup && (
        <SelectField
          label={T.ageGroup}
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          hint={ageGroup ? T.ageGroupHint : T.calculatedHint}
        >
          <option value="">{T.calculatedOption}</option>
          {tournament.ageGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
      )}
      <DayPicker startDate={tournament.startDate} endDate={tournament.endDate} value={days} onChange={setDays} showError={submitted} />
      <ErrorAlert error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button onClick={submit} loading={busy}>
          {T.add(teamIds.length)}
        </Button>
      </div>
    </div>
  );
}
