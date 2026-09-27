"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { dayNumber, isValidDay } from "@/lib/days";
import { sortMilestones } from "@/lib/participation";
import { useParticipationDefaults } from "@/lib/queries";
import type { MilestoneInput, Tournament, TournamentInput } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { MilestoneEditor, milestoneLabels, toMilestoneInputs } from "./milestone-editor";

const T = {
  newTitle: "New tournament",
  editTitle: (name: string) => `Edit ${name}`,
  name: "Name",
  url: "Website",
  urlHint: "Optional link to the tournament page.",
  start: "Start date",
  end: "End date",
  description: "Description",
  ageGroups: "Age groups",
  ageGroupsHint: "e.g. U10, U12.",
  timeline: "Customize the participation timeline (optional)",
  timelineHint: "By default the timeline from Settings is used. You can also change it later on the tournament page.",
  loadingDefaults: "Loading default timeline…",
  cancel: "Cancel",
  create: "Create tournament",
  save: "Save changes",
  errorTitle: "Could not save the tournament",
  errors: {
    name: "Name is required.",
    start: "Enter a valid start date.",
    end: "Enter a valid end date.",
    order: "The end date must not be before the start date.",
    url: "Enter a full address starting with http:// or https://.",
  },
};

interface Props {
  open: boolean;
  /** null = create. */
  tournament: Tournament | null;
  onClose: () => void;
  onSaved: (tournament: Tournament) => void;
}

export function TournamentFormDialog({ open, tournament, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={tournament ? T.editTitle(tournament.name) : T.newTitle} size="lg">
      <TournamentForm tournament={tournament} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(input: TournamentInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = T.errors.name;
  if (!isValidDay(input.startDate)) errors.startDate = T.errors.start;
  if (!isValidDay(input.endDate)) errors.endDate = T.errors.end;
  else if (!errors.startDate && dayNumber(input.endDate) < dayNumber(input.startDate)) errors.endDate = T.errors.order;
  if (input.url && !isHttpUrl(input.url)) errors.url = T.errors.url;
  return errors;
}

function TournamentForm({ tournament, onClose, onSaved }: Omit<Props, "open">) {
  const [name, setName] = useState(tournament?.name ?? "");
  const [url, setUrl] = useState(tournament?.url ?? "");
  const [startDate, setStartDate] = useState(tournament?.startDate ?? "");
  const [endDate, setEndDate] = useState(tournament?.endDate ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [ageGroups, setAgeGroups] = useState<string[]>(tournament?.ageGroups ?? []);
  const [milestones, setMilestones] = useState<MilestoneInput[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TournamentInput = {
      name: name.trim(),
      url: url.trim() || null,
      startDate,
      endDate,
      description: description.trim() || null,
      ageGroups,
      ...(milestones ? { milestones } : {}),
    };
    const found = validate(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const saved = tournament
        ? await api.patch<Tournament>(`/tournaments/${tournament.id}`, input)
        : await api.post<Tournament>("/tournaments", input);
      onSaved(saved);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorAlert error={error} title={T.errorTitle} />
      <TextField label={T.name} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Cape Cod Classic 2026" />
      <TextField label={T.url} type="url" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} hint={T.urlHint} placeholder="https://" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={T.start} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} error={errors.startDate} />
        <TextField label={T.end} type="date" required value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} error={errors.endDate} />
      </div>
      <TextAreaField label={T.description} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <TagInput label={T.ageGroups} value={ageGroups} onChange={setAgeGroups} hint={T.ageGroupsHint} placeholder="U12" />
      {!tournament && <TimelineCustomizer milestones={milestones} onChange={setMilestones} startDate={startDate} endDate={endDate} />}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button type="submit" loading={busy}>
          {tournament ? T.save : T.create}
        </Button>
      </div>
    </form>
  );
}

interface CustomizerProps {
  milestones: MilestoneInput[] | null;
  onChange: (milestones: MilestoneInput[]) => void;
  startDate: string;
  endDate: string;
}

/** Collapsed by default; milestones are only sent once the user edits them (else the server defaults apply). */
function TimelineCustomizer({ milestones, onChange, startDate, endDate }: CustomizerProps) {
  const defaults = useParticipationDefaults();
  const rows = milestones ?? (defaults.data ? sortMilestones(toMilestoneInputs(defaults.data)) : null);
  return (
    <details className="rounded-md border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">{T.timeline}</summary>
      <p className="mb-3 mt-1 text-xs text-slate-600">{T.timelineHint}</p>
      {defaults.error && !rows && <ErrorAlert error={defaults.error} />}
      {rows ? (
        <MilestoneEditor
          value={rows}
          onChange={onChange}
          labels={defaults.data ? milestoneLabels(defaults.data) : undefined}
          startDate={startDate}
          endDate={endDate}
        />
      ) : (
        !defaults.error && <p className="text-sm text-slate-600">{T.loadingDefaults}</p>
      )}
    </details>
  );
}
