"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { cn, pluralize } from "@/lib/format";
import type { Tournament, TournamentRequiredVariable } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { TOURNAMENT_VARIABLES_ID, useFocusOnHash, variableInputId } from "@/components/variables/variables-link";

const T = {
  title: "Variables",
  intro: "Values for the {{tournament.vars.…}} placeholders in this tournament’s emails. They apply to all teams; a team can override a value on its participation page.",
  usedBy: (names: string) => `Used by: ${names}`,
  missing: "Missing – emails using it cannot be sent or copied",
  missingFor: (n: number) => `Missing for ${pluralize(n, "team")}`,
  missingCount: (n: number) => `${n} missing`,
  noneRequired: "No email of this tournament uses a variable yet. You can still prepare values below.",
  otherTitle: "Prepared values (not used by any unsent email)",
  otherHint: "Stored for later, e.g. before a template uses them. Safe to remove.",
  remove: "Remove",
  removeLabel: (key: string) => `Remove variable ${key}`,
  addTitle: "Add a value",
  key: "Key",
  keyHint: "Letters, digits and _, e.g. venue. Use it as {{tournament.vars.venue}}.",
  value: "Value",
  add: "Add",
  save: "Save variables",
  saved: "Variables saved.",
  removed: (key: string) => `Variable “${key}” removed.`,
  saveFailed: "Could not save the variables",
  errors: { key: "Use 1–50 letters, digits or _.", duplicate: "This key already exists." },
};

const KEY_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

/** Drops blank values: a blank value counts as missing anyway. */
const withoutBlanks = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ""));

/** Tournament-wide variable values: required keys (from the emails) plus prepared ones. */
export function TournamentVariables({ tournament, onSaved }: { tournament: Tournament; onSaved: () => void }) {
  const toast = useToast();
  const stored = tournament.variables ?? {};
  const required = tournament.requiredVariables ?? [];
  const requiredKeys = new Set(required.map((v) => v.key));
  // Only the keys the user edited or added; everything else shows the stored value.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [seenUpdatedAt, setSeenUpdatedAt] = useState(tournament.updatedAt);
  if (seenUpdatedAt !== tournament.updatedAt) {
    // Fresh data arrived: drop edits that are now stored, keep the ones still unsaved.
    setSeenUpdatedAt(tournament.updatedAt);
    setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== (stored[k] ?? ""))));
  }
  useFocusOnHash(TOURNAMENT_VARIABLES_ID, true);

  const valueOf = (key: string) => draft[key] ?? stored[key] ?? "";
  const dirty = Object.keys(draft).some((key) => draft[key] !== (stored[key] ?? ""));
  const otherKeys = Array.from(new Set([...Object.keys(stored), ...Object.keys(draft)]))
    .filter((key) => !requiredKeys.has(key))
    .sort();
  const missingCount = required.filter((v) => !valueOf(v.key).trim() || v.missingFor > 0).length;
  const setValue = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function patch(variables: Record<string, string>, success: string, busyKey: string) {
    setBusy(busyKey);
    setError(null);
    try {
      await api.patch<Tournament>(`/tournaments/${tournament.id}`, { variables: withoutBlanks(variables) });
      toast.show(success);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  function remove(key: string) {
    setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)));
    if (!(key in stored)) return;
    const rest = Object.fromEntries(Object.entries(stored).filter(([k]) => k !== key));
    void patch(rest, T.removed(key), `remove:${key}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Missing values never block saving: the backend blocks sending instead.
    void patch({ ...stored, ...draft }, T.saved, "save");
  }

  return (
    <section
      id={TOURNAMENT_VARIABLES_ID}
      aria-labelledby={`${TOURNAMENT_VARIABLES_ID}-title`}
      tabIndex={-1}
      className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${TOURNAMENT_VARIABLES_ID}-title`} className="text-base font-semibold text-slate-900">
          {T.title}
        </h2>
        {missingCount > 0 && <Badge tone="amber">{T.missingCount(missingCount)}</Badge>}
      </div>
      <p className="mb-3 text-sm text-slate-600">{T.intro}</p>
      <ErrorAlert error={error} title={T.saveFailed} className="mb-3" />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {required.length === 0 ? (
          <p className="text-sm text-slate-600">{T.noneRequired}</p>
        ) : (
          <fieldset className="space-y-3">
            <legend className="sr-only">{T.title}</legend>
            {required.map((variable) => (
              <RequiredInput key={variable.key} variable={variable} value={valueOf(variable.key)} onChange={(v) => setValue(variable.key, v)} />
            ))}
          </fieldset>
        )}
        {otherKeys.length > 0 && (
          <OtherValues keys={otherKeys} valueOf={valueOf} onChange={setValue} onRemove={remove} busy={busy} />
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={busy === "save"} disabled={!dirty || busy !== null}>
            {T.save}
          </Button>
        </div>
      </form>
      <AddVariable existing={new Set([...requiredKeys, ...otherKeys])} onAdd={setValue} />
    </section>
  );
}

function RequiredInput({ variable, value, onChange }: { variable: TournamentRequiredVariable; value: string; onChange: (value: string) => void }) {
  const id = variableInputId(TOURNAMENT_VARIABLES_ID, variable.key);
  const missing = !value.trim();
  const hintId = `${id}-hint`;
  const missingId = `${id}-missing`;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="block font-mono text-sm font-medium text-slate-800">
          {variable.key}
        </label>
        {variable.missingFor > 0 && <Badge tone="amber">{T.missingFor(variable.missingFor)}</Badge>}
      </div>
      <input
        id={id}
        className={cn(inputClass, missing && "border-amber-500 bg-amber-50 ring-1 ring-amber-400")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-missing={missing ? "true" : undefined}
        aria-describedby={missing ? `${missingId} ${hintId}` : hintId}
      />
      {missing && (
        <p id={missingId} className="text-xs font-medium text-amber-900">
          {T.missing}
        </p>
      )}
      <p id={hintId} className="text-xs text-slate-600">
        {T.usedBy(variable.usedBy.join(", ") || "—")}
      </p>
    </div>
  );
}

interface OtherProps {
  keys: string[];
  valueOf: (key: string) => string;
  onChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  busy: string | null;
}

function OtherValues({ keys, valueOf, onChange, onRemove, busy }: OtherProps) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-800">{T.otherTitle}</h3>
      <p className="text-xs text-slate-600">{T.otherHint}</p>
      <ul className="mt-2 space-y-2">
        {keys.map((key) => {
          const id = variableInputId(TOURNAMENT_VARIABLES_ID, key);
          return (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <label htmlFor={id} className="w-40 shrink-0 truncate font-mono text-sm font-medium text-slate-800" title={key}>
                {key}
              </label>
              <input id={id} className={cn(inputClass, "min-w-0 flex-1")} value={valueOf(key)} onChange={(e) => onChange(key, e.target.value)} />
              <Button
                variant="danger-ghost"
                size="sm"
                onClick={() => onRemove(key)}
                loading={busy === `remove:${key}`}
                disabled={busy !== null}
                aria-label={T.removeLabel(key)}
              >
                {T.remove}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Adds a key/value to the draft (saved with "Save variables"). */
function AddVariable({ existing, onAdd }: { existing: Set<string>; onAdd: (key: string, value: string) => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [keyError, setKeyError] = useState<string | undefined>();

  function add() {
    const trimmed = key.trim();
    const problem = !KEY_PATTERN.test(trimmed) ? T.errors.key : existing.has(trimmed) ? T.errors.duplicate : undefined;
    setKeyError(problem);
    if (problem) return;
    onAdd(trimmed, value);
    setKey("");
    setValue("");
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{T.addTitle}</h3>
      <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
        <TextField label={T.key} value={key} onChange={(e) => setKey(e.target.value)} error={keyError} hint={T.keyHint} className="font-mono" />
        <TextField label={T.value} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button variant="secondary" onClick={add} className="sm:mt-6">
          {T.add}
        </Button>
      </div>
    </div>
  );
}
