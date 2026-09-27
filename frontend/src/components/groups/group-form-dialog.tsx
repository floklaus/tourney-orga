"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { TeamGroup } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";

interface Props {
  open: boolean;
  group: TeamGroup | null;
  onClose: () => void;
  onSaved: (group: TeamGroup) => void;
}

export function GroupFormDialog({ open, group, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={group ? `Edit ${group.name}` : "New group"}>
      <GroupForm group={group} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function GroupForm({ group, onClose, onSaved }: Omit<Props, "open">) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(undefined);
    setBusy(true);
    setError(null);
    const body = { name: name.trim(), description: description.trim() || null };
    try {
      const saved = group
        ? await api.patch<TeamGroup>(`/groups/${group.id}`, body)
        : await api.post<TeamGroup>("/groups", body);
      onSaved(saved);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorAlert error={error} />
      <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
      <TextAreaField label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {group ? "Save changes" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
