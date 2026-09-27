"use client";

import { Alert } from "@/components/ui/alert";
import { participationVariablesHref, tournamentVariablesHref, VariablesLink } from "./variables-link";

const T = {
  message: (keys: string) => `This email can't be copied or sent yet: missing variable(s) ${keys}.`,
  step: (keys: string) => `These emails can't be sent yet: missing variable(s) ${keys}.`,
  tournament: "Set the values for all teams on the tournament page",
  participation: "Override them for this team",
};

interface Props {
  keys: string[];
  tournamentId?: string | null;
  participationId?: string | null;
  /** "message" for a single email, "step" for several emails. */
  scope?: "message" | "step";
  /** Called before following a link (e.g. to close the dialog). */
  onNavigate?: () => void;
  className?: string;
}

/** Warning for the 422 `{missingVariables}` that blocks sending, copying and marking emails as sent. */
export function MissingVariablesNotice({ keys, tournamentId, participationId, scope = "message", onNavigate, className }: Props) {
  const list = keys.join(", ");
  return (
    <Alert tone="warning" title={scope === "message" ? T.message(list) : T.step(list)} className={className}>
      {(tournamentId || participationId) && (
        <ul className="space-y-0.5">
          {tournamentId && (
            <li>
              <VariablesLink href={tournamentVariablesHref(tournamentId)} onNavigate={onNavigate}>
                {T.tournament}
              </VariablesLink>
            </li>
          )}
          {participationId && (
            <li>
              <VariablesLink href={participationVariablesHref(participationId)} onNavigate={onNavigate}>
                {T.participation}
              </VariablesLink>
            </li>
          )}
        </ul>
      )}
    </Alert>
  );
}
