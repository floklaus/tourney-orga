"use client";

import type { Team, TeamGroup } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { TeamForm } from "./team-form";

interface Props {
  open: boolean;
  team: Team | null;
  groups: TeamGroup[];
  onClose: () => void;
  onSaved: (team: Team) => void;
}

/** Quick create/edit dialog on the Teams list; the team page (/teams/:id) is the full edit page. */
export function TeamFormDialog({ open, team, groups, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={team ? `Edit ${team.name}` : "New team"} size="lg">
      <TeamForm team={team} groups={groups} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}
