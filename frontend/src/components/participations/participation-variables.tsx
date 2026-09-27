"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { isConflict } from "@/lib/errors";
import { cn } from "@/lib/format";
import type { Participation, ParticipationDetail, ParticipationRequiredVariable } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  PARTICIPATION_VARIABLES_ID,
  tournamentVariablesHref,
  useFocusOnHash,
  VariablesLink,
  variableInputId,
} from "@/components/variables/variables-link";

const T = {
  title: "Variables",
  intro: "Values used by this team’s emails. By default the tournament value applies; enter a value here to override it for this team only.",
  tournamentLink: "Edit the values for all teams",
  none: "None of this team’s unsent emails uses a variable.",
  effective: "Effective value",
  override: (key: string) => `Override for ${key}`,
  overridePlaceholder: (value: string | null) => (value ? `Tournament value: ${value}` : "No tournament value – enter one for this team"),
  tournamentValue: (value: string) => `Tournament value: ${value}`,
  sourceTournament: "Tournament",
  sourceOverride: "Override",
  missing: "Missing",
  missingHint: "Emails using it cannot be sent or copied.",
  usedBy: (names: string) => `Used by: ${names}`,
  clear: "Clear override",
  clearLabel: (key: string) => `Clear the override of ${key}`,
  otherTitle: "Overrides not used by any unsent email",
  save: "Save overrides",
  saved: "Overrides saved.",
  cleared: (key: string) => `Override of “${key}” cleared.`,
  saveFailed: "Could not save the overrides",
  conflict: "This participation was changed in the meantime. The page was reloaded; please apply your change again.",
};

const withoutBlanks = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ""));

interface Props {
  participation: ParticipationDetail;
  /** Tournament-wide values (for the "Tournament value" hints); undefined while loading. */
  tournamentValues: Record<string, string> | undefined;
  onSaved: () => void;
}

/** Per-team overrides of the tournament variables, with each key's effective value and source. */
export function ParticipationVariables({ participation: p, tournamentValues, onSaved }: Props) {
  const toast = useToast();
  const overrides = p.variables ?? {};
  const required = p.requiredVariables ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [seenVersion, setSeenVersion] = useState(p.version);
  if (seenVersion !== p.version) {
    setSeenVersion(p.version);
    setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== (overrides[k] ?? ""))));
  }
  useFocusOnHash(PARTICIPATION_VARIABLES_ID, true);

  const valueOf = (key: string) => draft[key] ?? overrides[key] ?? "";
  const dirty = Object.keys(draft).some((key) => draft[key] !== (overrides[key] ?? ""));
  const requiredKeys = new Set(required.map((v) => v.key));
  const unusedOverrides = Object.keys(overrides).filter((k) => !requiredKeys.has(k) && overrides[k].trim() !== "");

  async function patch(variables: Record<string, string>, success: string, busyKey: string) {
    setBusy(busyKey);
    setError(null);
    try {
      await api.patch<Participation>(`/participations/${p.id}`, { version: p.version, variables: withoutBlanks(variables) });
      toast.show(success);
      onSaved();
    } catch (err) {
      setError(err);
      if (isConflict(err)) onSaved();
    } finally {
      setBusy(null);
    }
  }

  function clear(key: string) {
    setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)));
    if (!overrides[key]) return;
    void patch(Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== key)), T.cleared(key), `clear:${key}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void patch({ ...overrides, ...draft }, T.saved, "save");
  }

  return (
    <section
      id={PARTICIPATION_VARIABLES_ID}
      aria-labelledby={`${PARTICIPATION_VARIABLES_ID}-title`}
      tabIndex={-1}
      className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${PARTICIPATION_VARIABLES_ID}-title`} className="text-base font-semibold text-slate-900">
          {T.title}
        </h2>
        <VariablesLink href={tournamentVariablesHref(p.tournament.id)} className="text-sm font-medium text-brand-primary underline">
          {T.tournamentLink}
        </VariablesLink>
      </div>
      <p className="mb-3 text-sm text-slate-600">{T.intro}</p>
      {isConflict(error) ? <Alert tone="warning" className="mb-3">{T.conflict}</Alert> : <ErrorAlert error={error} title={T.saveFailed} className="mb-3" />}
      {required.length === 0 && unusedOverrides.length === 0 ? (
        <p className="text-sm text-slate-600">{T.none}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ul className="space-y-4">
            {required.map((variable) => (
              <VariableRow
                key={variable.key}
                variable={variable}
                value={valueOf(variable.key)}
                tournamentValue={tournamentValues?.[variable.key] ?? (variable.source === "TOURNAMENT" ? variable.value : null)}
                hasOverride={Boolean(overrides[variable.key])}
                busy={busy}
                onChange={(value) => setDraft((d) => ({ ...d, [variable.key]: value }))}
                onClear={() => clear(variable.key)}
              />
            ))}
          </ul>
          {unusedOverrides.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-sm font-semibold text-slate-800">{T.otherTitle}</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {unusedOverrides.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono font-medium text-slate-800">{key}</span>
                      <span className="ml-2 break-all text-slate-600">{overrides[key]}</span>
                    </span>
                    <Button variant="danger-ghost" size="sm" onClick={() => clear(key)} loading={busy === `clear:${key}`} disabled={busy !== null} aria-label={T.clearLabel(key)}>
                      {T.clear}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {required.length > 0 && (
            <div className="flex justify-end">
              <Button type="submit" loading={busy === "save"} disabled={!dirty || busy !== null}>
                {T.save}
              </Button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

interface RowProps {
  variable: ParticipationRequiredVariable;
  value: string;
  tournamentValue: string | null;
  hasOverride: boolean;
  busy: string | null;
  onChange: (value: string) => void;
  onClear: () => void;
}

function SourceBadge({ variable }: { variable: ParticipationRequiredVariable }) {
  if (!variable.value) return <Badge tone="amber">{T.missing}</Badge>;
  return variable.source === "PARTICIPATION" ? <Badge tone="purple">{T.sourceOverride}</Badge> : <Badge tone="blue">{T.sourceTournament}</Badge>;
}

function VariableRow({ variable, value, tournamentValue, hasOverride, busy, onChange, onClear }: RowProps) {
  const id = variableInputId(PARTICIPATION_VARIABLES_ID, variable.key);
  const missing = !variable.value && !value.trim();
  const hintId = `${id}-hint`;
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium text-slate-800">{variable.key}</span>
        <SourceBadge variable={variable} />
        {variable.value && (
          <span className="text-sm text-slate-700">
            <span className="sr-only">{T.effective}: </span>
            {variable.value}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {T.override(variable.key)}
        </label>
        <input
          id={id}
          className={cn(inputClass, "min-w-0 flex-1", missing && "border-amber-500 bg-amber-50 ring-1 ring-amber-400")}
          value={value}
          placeholder={T.overridePlaceholder(tournamentValue)}
          onChange={(e) => onChange(e.target.value)}
          data-missing={missing ? "true" : undefined}
          aria-describedby={hintId}
        />
        {hasOverride && (
          <Button variant="ghost" size="sm" onClick={onClear} loading={busy === `clear:${variable.key}`} disabled={busy !== null} aria-label={T.clearLabel(variable.key)}>
            {T.clear}
          </Button>
        )}
      </div>
      <p id={hintId} className="text-xs text-slate-600">
        {missing && <span className="font-medium text-amber-900">{T.missingHint} </span>}
        {hasOverride && tournamentValue && <span>{T.tournamentValue(tournamentValue)} · </span>}
        {T.usedBy(variable.steps.map((s) => s.name).join(", ") || "—")}
      </p>
    </li>
  );
}
