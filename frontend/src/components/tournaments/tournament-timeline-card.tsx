"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { sortMilestones } from "@/lib/participation";
import type { MilestoneInput, Tournament } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { MilestoneEditor, milestoneLabels, toMilestoneInputs } from "./milestone-editor";

const T = {
  title: "Timeline",
  hint: "When each step of the participation process is due, relative to the tournament dates. Changes apply to all participating teams.",
  save: "Save timeline",
  reset: "Discard changes",
  saved: "Timeline saved.",
  error: "Could not save the timeline",
};

/** Edits the 8 milestones of a tournament (PATCH milestones; 422 names steps whose due dates go backwards). */
export function TournamentTimelineCard({ tournament, onSaved }: { tournament: Tournament; onSaved: (t: Tournament) => void }) {
  const toast = useToast();
  const initial = sortMilestones(toMilestoneInputs(tournament.milestones));
  const [milestones, setMilestones] = useState<MilestoneInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = JSON.stringify(milestones) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.patch<Tournament>(`/tournaments/${tournament.id}`, { milestones });
      toast.show(T.saved);
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={T.title}>
      <p className="mb-3 text-sm text-slate-600">{T.hint}</p>
      <MilestoneEditor
        value={milestones}
        onChange={setMilestones}
        labels={milestoneLabels(tournament.milestones)}
        startDate={tournament.startDate}
        endDate={tournament.endDate}
      />
      <ErrorAlert error={error} title={T.error} className="mt-3" />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setMilestones(initial)} disabled={!dirty || busy}>
          {T.reset}
        </Button>
        <Button onClick={save} loading={busy} disabled={!dirty}>
          {T.save}
        </Button>
      </div>
    </Card>
  );
}
