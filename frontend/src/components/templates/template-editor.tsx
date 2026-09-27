"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useAllTeams, usePlaceholders } from "@/lib/queries";
import { useApi } from "@/lib/use-api";
import type { EmailTemplate } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { HtmlEditor } from "@/components/editor/html-editor";
import { PlaceholderPicker } from "@/components/editor/placeholder-picker";
import { applyEdit, insertText } from "@/components/editor/text-insert";
import { TemplatePreview } from "./template-preview";

const T = {
  newTitle: "New template",
  back: "← All templates",
  name: "Name",
  subject: "Subject",
  body: "Body (HTML)",
  save: "Save template",
  saved: "Template saved.",
  placeholderHint: "Use placeholders such as {{team.name}}, {{tournament.name}} or {{tournament.vars.venue}}. Unknown placeholders are rejected on save.",
};

export function TemplateEditor({ templateId }: { templateId?: string }) {
  const template = useApi(templateId ? `template:${templateId}` : null, () =>
    api.get<EmailTemplate>(`/templates/${templateId}`),
  );
  if (!templateId) return <TemplateForm template={null} />;
  return (
    <QueryView {...template} onRetry={template.reload}>
      {(data) => <TemplateForm key={data.updatedAt} template={data} />}
    </QueryView>
  );
}

function TemplateForm({ template }: { template: EmailTemplate | null }) {
  const router = useRouter();
  const toast = useToast();
  const placeholders = usePlaceholders();
  const teams = useAllTeams();
  const subjectRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return;
    setBusy(true);
    setError(null);
    const body = { name: name.trim(), subject, bodyHtml };
    try {
      if (template) {
        await api.patch<EmailTemplate>(`/templates/${template.id}`, body);
        toast.show(T.saved);
      } else {
        const created = await api.post<EmailTemplate>("/templates", body);
        toast.show(T.saved);
        router.replace(`/templates/${created.id}`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function insertIntoSubject(token: string) {
    const el = subjectRef.current;
    if (el) applyEdit(el, insertText(el, token), setSubject);
  }

  const required = (value: string) => (submitted && !value.trim() ? "Required." : undefined);

  return (
    <>
      <Link href="/templates" className="mb-2 inline-block text-sm font-medium text-brand-primary underline">
        {T.back}
      </Link>
      <PageHeader title={template ? template.name : T.newTitle} description={T.placeholderHint} />
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert error={error} title="Could not save the template" />
          <TextField label={T.name} required value={name} onChange={(e) => setName(e.target.value)} error={required(name)} />
          <div className="flex items-end gap-2">
            <TextField
              ref={subjectRef}
              label={T.subject}
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              error={required(subject)}
              className="min-w-0 flex-1"
            />
            <PlaceholderPicker placeholders={placeholders.data ?? []} onInsert={insertIntoSubject} label="Insert into subject" />
          </div>
          <HtmlEditor
            label={T.body}
            required
            value={bodyHtml}
            onChange={setBodyHtml}
            placeholders={placeholders.data ?? []}
            error={required(bodyHtml)}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              {T.save}
            </Button>
          </div>
        </form>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <TemplatePreview subject={subject} bodyHtml={bodyHtml} teams={teams.data ?? []} tournamentSelect />
        </div>
      </div>
    </>
  );
}
