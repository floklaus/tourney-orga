"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { sortMilestones } from "@/lib/participation";
import { useParticipationDefaults } from "@/lib/queries";
import type { MilestoneDefault, MilestoneInput } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { MilestoneEditor, milestoneLabels, toMilestoneInputs } from "@/components/tournaments/milestone-editor";

const T = {
  title: "Participation timeline defaults",
  hint: "When each step is due relative to a tournament's start or end date. Used for new tournaments only; existing tournaments keep their own timeline.",
  save: "Save defaults",
  reset: "Discard changes",
  saved: "Timeline defaults saved.",
  error: "Could not save the defaults",
};

export function ParticipationDefaultsCard() {
  const defaults = useParticipationDefaults();
  return (
    <Card title={T.title}>
      <p className="mb-3 text-sm text-slate-600">{T.hint}</p>
      <QueryView {...defaults} onRetry={defaults.reload}>
        {(data) => <DefaultsForm key={JSON.stringify(data)} defaults={data} onSaved={defaults.reload} />}
      </QueryView>
    </Card>
  );
}

function DefaultsForm({ defaults, onSaved }: { defaults: MilestoneDefault[]; onSaved: () => void }) {
  const toast = useToast();
  const initial = sortMilestones(toMilestoneInputs(defaults));
  const [milestones, setMilestones] = useState<MilestoneInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = JSON.stringify(milestones) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put<MilestoneDefault[]>("/participation/defaults", { milestones });
      toast.show(T.saved);
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <MilestoneEditor value={milestones} onChange={setMilestones} labels={milestoneLabels(defaults)} />
      <ErrorAlert error={error} title={T.error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setMilestones(initial)} disabled={!dirty || busy}>
          {T.reset}
        </Button>
        <Button onClick={save} loading={busy} disabled={!dirty}>
          {T.save}
        </Button>
      </div>
    </div>
  );
}
