"use client";

import type { Team } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { TeamForm } from "./team-form";

interface Props {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onSaved: (team: Team) => void;
}

/** Quick create/edit dialog on the Teams list; the team page (/teams/:id) is the full edit page. */
export function TeamFormDialog({ open, team, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={team ? `Edit ${team.name}` : "New team"} size="lg">
      <TeamForm team={team} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}
