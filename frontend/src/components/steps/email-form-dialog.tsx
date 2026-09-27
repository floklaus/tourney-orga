"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { isConflict } from "@/lib/errors";
import { fromTimingValue, toTimingValue, validateTiming, type TimingErrors, type TimingValue, type TournamentDates } from "@/lib/email-timing";
import { useTemplates } from "@/lib/queries";
import type { EmailTiming } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { StepTimingFields } from "./step-timing-fields";

const T = {
  name: "Name",
  namePlaceholder: "e.g. Waiver reminder",
  template: "Template",
  chooseTemplate: "Choose a template…",
  loadingTemplates: "Loading templates…",
  unknownTemplate: "(template no longer available)",
  subject: "Subject override",
  subjectHint: "Optional. Leave empty to use the template subject.",
  cancel: "Cancel",
  close: "Close",
  reload: "Reload",
  errorTitle: "Could not save the email",
  conflictTitle: "This email was changed in the meantime",
  conflict: "Someone else saved it, or its status no longer allows editing. Reload to see the latest version, then apply your changes again.",
  manualHint:
    "Manual sending mode: at the send time, the email is prepared for you to copy and send from your own mail program. Nothing is sent automatically.",
  errors: { name: "Name is required.", template: "Choose a template." },
};

/** What the form edits: an email plan item or a participation email step. */
export interface EmailFormValue extends EmailTiming {
  name: string;
  templateId: string;
  subjectOverride: string | null;
}

export interface EmailFormInitial extends EmailTiming {
  name: string;
  templateId: string | null;
  templateName?: string | null;
  subjectOverride: string | null;
}

interface Props {
  open: boolean;
  title: string;
  /** null = new email. */
  initial: EmailFormInitial | null;
  timeZone: string;
  dates?: TournamentDates | null;
  submitLabel: string;
  description?: ReactNode;
  manual?: boolean;
  onClose: () => void;
  /** Saves; a thrown error is shown in the form. */
  onSubmit: (value: EmailFormValue) => Promise<void>;
  /** Offered after a 409 (e.g. reload the page data). */
  onConflictReload?: () => void;
}

export function EmailFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} description={props.description} size="lg">
      <EmailForm {...props} />
    </Dialog>
  );
}

type Errors = TimingErrors & { name?: string; templateId?: string };

function EmailForm({ initial, timeZone, dates, submitLabel, manual = false, onClose, onSubmit, onConflictReload }: Omit<Props, "open" | "title">) {
  const templates = useTemplates();
  const [name, setName] = useState(initial?.name ?? "");
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [subjectOverride, setSubjectOverride] = useState(initial?.subjectOverride ?? "");
  const [timing, setTiming] = useState<TimingValue>(() => toTimingValue(initial, timeZone));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = { ...validateTiming(timing) };
    if (!name.trim()) found.name = T.errors.name;
    if (!templateId) found.templateId = T.errors.template;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), templateId, subjectOverride: subjectOverride.trim() || null, ...fromTimingValue(timing, timeZone) });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (isConflict(error) && onConflictReload) {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title={T.conflictTitle}>
          {T.conflict}
        </Alert>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {T.close}
          </Button>
          <Button onClick={onConflictReload}>{T.reload}</Button>
        </div>
      </div>
    );
  }

  const options = templates.data ?? [];
  // Keep a template that is no longer listed (e.g. deleted) visible instead of silently switching.
  const missingCurrent = initial?.templateId && !options.some((t) => t.id === initial.templateId) && templates.data;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorAlert error={error} title={T.errorTitle} />
      <TextField label={T.name} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder={T.namePlaceholder} />
      <SelectField
        label={T.template}
        required
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        error={errors.templateId ?? (templates.error ? templates.error.message : undefined)}
        hint={templates.data ? undefined : T.loadingTemplates}
        disabled={!templates.data && !templates.error}
      >
        <option value="">{T.chooseTemplate}</option>
        {missingCurrent && <option value={initial.templateId ?? ""}>{initial.templateName ?? T.unknownTemplate}</option>}
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <TextField label={T.subject} value={subjectOverride} onChange={(e) => setSubjectOverride(e.target.value)} hint={T.subjectHint} />
      <StepTimingFields value={timing} onChange={setTiming} timeZone={timeZone} dates={dates} errors={errors} />
      {manual && <p className="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-950">{T.manualHint}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {T.cancel}
        </Button>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
