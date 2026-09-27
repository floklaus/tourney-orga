"use client";

import { useState, type FormEvent } from "react";
import { ageGroupFor, gradeLabel, MAX_GRADUATION_YEAR, MIN_GRADUATION_YEAR } from "@/lib/age-group";
import { api } from "@/lib/api";
import { isValidEmail, parseEmailList } from "@/lib/format";
import { useSettings } from "@/lib/queries";
import type { Team, TeamGroup, TeamInput } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxList } from "@/components/ui/checkbox-list";
import { TextAreaField, TextField } from "@/components/ui/field";

const MAX_CC = 5;

function validate(input: TeamInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Name is required.";
  if (!input.contactName.trim()) errors.contactName = "Contact name is required.";
  if (!isValidEmail(input.email)) errors.email = "Enter a valid email address.";
  const year = input.graduationYear;
  if (year !== null && year !== undefined && !(Number.isInteger(year) && year >= MIN_GRADUATION_YEAR && year <= MAX_GRADUATION_YEAR))
    errors.graduationYear = `Enter a year between ${MIN_GRADUATION_YEAR} and ${MAX_GRADUATION_YEAR}.`;
  const cc = input.ccEmails ?? [];
  if (cc.length > MAX_CC) errors.ccEmails = `At most ${MAX_CC} CC addresses.`;
  else if (cc.some((e) => !isValidEmail(e))) errors.ccEmails = "One or more CC addresses are invalid.";
  return errors;
}

export interface TeamFormProps {
  team: Team | null;
  groups: TeamGroup[];
  /** Omit to hide the Cancel button (e.g. on the team page). */
  onClose?: () => void;
  onSaved: (team: Team) => void;
}

/** Name, contact, email, CC, notes and groups; POST /teams or PATCH /teams/:id. */
export function TeamForm({ team, groups, onClose, onSaved }: TeamFormProps) {
  const [name, setName] = useState(team?.name ?? "");
  const [contactName, setContactName] = useState(team?.contactName ?? "");
  const [email, setEmail] = useState(team?.email ?? "");
  const [cc, setCc] = useState((team?.ccEmails ?? []).join(", "));
  const [graduationYear, setGraduationYear] = useState(team?.graduationYear?.toString() ?? "");
  const seasonStartMonth = useSettings().data?.seasonStartMonth ?? 9;
  const [notes, setNotes] = useState(team?.notes ?? "");
  const [groupIds, setGroupIds] = useState<string[]>(team?.groups.map((g) => g.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TeamInput = {
      name: name.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      ccEmails: parseEmailList(cc),
      graduationYear: graduationYear.trim() ? Number(graduationYear) : null,
      notes: notes.trim() || null,
      groupIds,
    };
    const found = validate(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const saved = team
        ? await api.patch<Team>(`/teams/${team.id}`, input)
        : await api.post<Team>("/teams", input);
      onSaved(saved);
      setBusy(false);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorAlert error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Team name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField label="Contact name" required value={contactName} onChange={(e) => setContactName(e.target.value)} error={errors.contactName} />
      </div>
      <GraduationYearField value={graduationYear} onChange={setGraduationYear} seasonStartMonth={seasonStartMonth} error={errors.graduationYear} />
      <TextField label="Primary email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <TextField
        label="CC emails"
        value={cc}
        onChange={(e) => setCc(e.target.value)}
        hint={`Optional, up to ${MAX_CC}, separated by commas.`}
        error={errors.ccEmails}
      />
      <TextAreaField label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <CheckboxList
        legend="Groups"
        options={groups.map((g) => ({ id: g.id, name: g.name }))}
        selected={groupIds}
        onChange={setGroupIds}
        searchable
        emptyText="No groups yet. Create groups on the Groups page."
      />
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {team ? "Save changes" : "Create team"}
        </Button>
      </div>
    </form>
  );
}

function GraduationYearField({
  value,
  onChange,
  seasonStartMonth,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  seasonStartMonth: number;
  error?: string;
}) {
  const year = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(year) && year >= MIN_GRADUATION_YEAR && year <= MAX_GRADUATION_YEAR;
  return (
    <TextField
      label="Graduation year"
      type="number"
      inputMode="numeric"
      min={MIN_GRADUATION_YEAR}
      max={MAX_GRADUATION_YEAR}
      placeholder="e.g. 2031"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={
        valid
          ? `Age group now: ${ageGroupFor(year, seasonStartMonth)} (${gradeLabel(year, seasonStartMonth)}).`
          : "Optional. The age group is calculated from it."
      }
    />
  );
}
