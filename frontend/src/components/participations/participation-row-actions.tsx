"use client";

import { allowedTransitions, statusLabel } from "@/lib/participation";
import type { Participation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Menu, type MenuSection } from "@/components/ui/menu";
import type { ParticipationActions } from "./use-participation-actions";

const T = {
  advance: (label: string) => `→ ${label}`,
  advanceLabel: (label: string, team: string) => `Advance ${team} to ${label}`,
  status: "Status",
  statusLabel: (team: string) => `Change status of ${team}`,
  forward: "Move forward to",
  undo: "Undo",
  undoTo: (label: string) => `Back to ${label}`,
  other: "Other",
  withdraw: "Withdraw",
  reinstate: (label: string) => `Reinstate (${label})`,
  more: "More",
  moreLabel: (team: string) => `More actions for ${team}`,
  details: "Open details",
  edit: "Edit notes / age group",
  remove: "Remove from tournament",
};

function statusSections(p: Participation, actions: ParticipationActions): MenuSection[] {
  const allowed = allowedTransitions(p);
  const to = (status: Parameters<ParticipationActions["changeStatus"]>[1]) => () => actions.changeStatus(p, status);
  return [
    {
      heading: T.forward,
      items: allowed.forward.map((s) => ({ id: s, label: statusLabel(s, p), onSelect: to(s) })),
    },
    {
      heading: T.undo,
      items: allowed.back ? [{ id: `back:${allowed.back}`, label: T.undoTo(statusLabel(allowed.back, p)), onSelect: to(allowed.back) }] : [],
    },
    {
      heading: T.other,
      items: [
        ...(allowed.withdraw ? [{ id: "withdraw", label: T.withdraw, danger: true, onSelect: to("WITHDRAWN") }] : []),
        ...(allowed.reinstate
          ? [{ id: "reinstate", label: T.reinstate(statusLabel(allowed.reinstate, p)), onSelect: to(allowed.reinstate) }]
          : []),
      ],
    },
  ];
}

interface Props {
  participation: Participation;
  actions: ParticipationActions;
  /** On the participation page itself the "Open details" item is left out. */
  onDetailPage?: boolean;
}

/** Primary "advance to next step" plus menus for any allowed status and the other row actions. */
export function ParticipationRowActions({ participation: p, actions, onDetailPage = false }: Props) {
  const next = p.nextStatus;
  const sections = statusSections(p, actions);
  const hasStatusChoices = sections.some((s) => s.items.length > 0);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {next && (
        <Button
          size="sm"
          onClick={() => actions.advance(p)}
          loading={actions.busyId === p.id}
          disabled={actions.busyId !== null}
          aria-label={T.advanceLabel(statusLabel(next, p), p.team.name)}
          className="whitespace-nowrap"
        >
          {T.advance(statusLabel(next, p))}
        </Button>
      )}
      {hasStatusChoices && <Menu label={T.status} ariaLabel={T.statusLabel(p.team.name)} sections={sections} />}
      <Menu
        label={T.more}
        ariaLabel={T.moreLabel(p.team.name)}
        variant="ghost"
        sections={[
          {
            items: [
              ...(onDetailPage ? [] : [{ id: "details", label: T.details, onSelect: () => actions.open(p) }]),
              { id: "edit", label: T.edit, onSelect: () => actions.edit(p) },
              { id: "remove", label: T.remove, danger: true, onSelect: () => actions.remove(p) },
            ],
          },
        ]}
      />
    </div>
  );
}
