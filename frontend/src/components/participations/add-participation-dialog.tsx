"use client";

import { useState } from "react";
import { formatDayRange } from "@/lib/days";
import { useTournamentOptions } from "@/lib/queries";
import { ErrorAlert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/states";
import { AddTeamsForm } from "@/components/tournaments/add-teams-dialog";

const T = {
  title: "Add participation",
  description: "Choose a tournament, then the teams that take part. Each team gets a copy of the tournament’s email plan.",
  tournament: "Tournament",
  choose: "Choose a tournament…",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

/** Tournament select + the bulk "add teams" form (POST /participations/bulk). */
export function AddParticipationDialog({ open, onClose, onAdded }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={T.title} description={T.description} size="lg">
      <AddParticipationBody onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}

function AddParticipationBody({ onClose, onAdded }: Omit<Props, "open">) {
  const tournaments = useTournamentOptions();
  const [tournamentId, setTournamentId] = useState("");
  if (tournaments.error) return <ErrorAlert error={tournaments.error} />;
  if (!tournaments.data) return <LoadingState />;
  const selected = tournaments.data.find((t) => t.id === tournamentId);
  return (
    <div className="space-y-4">
      <SelectField label={T.tournament} required value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
        <option value="">{T.choose}</option>
        {tournaments.data.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({formatDayRange(t.startDate, t.endDate)})
          </option>
        ))}
      </SelectField>
      {/* Remounted per tournament: candidates, age group and results start fresh. */}
      {selected && <AddTeamsForm key={selected.id} tournament={selected} onClose={onClose} onAdded={onAdded} />}
    </div>
  );
}
