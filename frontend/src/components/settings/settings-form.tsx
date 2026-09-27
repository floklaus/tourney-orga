"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { isValidEmail } from "@/lib/format";
import type { Settings, SettingsPatch } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { useToast } from "@/components/ui/toast";

type Errors = Partial<Record<keyof SettingsPatch, string>>;

function validate(s: SettingsPatch): Errors {
  const errors: Errors = {};
  if (!s.organizerName?.trim()) errors.organizerName = "Required.";
  if (!s.senderName?.trim()) errors.senderName = "Required.";
  if (s.replyToEmail && !isValidEmail(s.replyToEmail)) errors.replyToEmail = "Enter a valid email address.";
  if (s.logoUrl && !/^https:\/\//i.test(s.logoUrl)) errors.logoUrl = "Use an https:// URL.";
  if (!Number.isInteger(s.ratePerMinute) || (s.ratePerMinute ?? 0) < 1) errors.ratePerMinute = "Enter a whole number ≥ 1.";
  if (!Number.isInteger(s.dailyRecipientCap) || (s.dailyRecipientCap ?? 0) < 1) errors.dailyRecipientCap = "Enter a whole number ≥ 1.";
  return errors;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const toast = useToast();
  const [organizerName, setOrganizerName] = useState(settings.organizerName);
  const [senderName, setSenderName] = useState(settings.senderName);
  const [replyToEmail, setReplyToEmail] = useState(settings.replyToEmail ?? "");
  const [timezone, setTimezone] = useState(settings.timezone);
  const [seasonStartMonth, setSeasonStartMonth] = useState(settings.seasonStartMonth);
  const [footerHtml, setFooterHtml] = useState(settings.footerHtml ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [ratePerMinute, setRatePerMinute] = useState(String(settings.ratePerMinute));
  const [dailyRecipientCap, setDailyRecipientCap] = useState(String(settings.dailyRecipientCap));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch: SettingsPatch = {
      organizerName: organizerName.trim(),
      senderName: senderName.trim(),
      replyToEmail: replyToEmail.trim() || null,
      timezone,
      seasonStartMonth,
      footerHtml: footerHtml.trim() || null,
      logoUrl: logoUrl.trim() || null,
      ratePerMinute: Number(ratePerMinute),
      dailyRecipientCap: Number(dailyRecipientCap),
    };
    const found = validate(patch);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.patch<Settings>("/settings", patch);
      toast.show("Settings saved.");
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <ErrorAlert error={error} title="Could not save settings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Organizer name" required value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} error={errors.organizerName} hint="Used for {{organizer.name}}." />
        <TextField label="Sender display name" required value={senderName} onChange={(e) => setSenderName(e.target.value)} error={errors.senderName} />
        <TextField label="Reply-To address" type="email" value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} error={errors.replyToEmail} hint="Optional, e.g. a shared address." />
        <TimezoneSelect label="Default timezone" value={timezone} onChange={setTimezone} />
        <SelectField
          label="Age groups roll over in"
          value={seasonStartMonth}
          onChange={(e) => setSeasonStartMonth(Number(e.target.value))}
          hint="From the 1st of this month, teams move up a grade and age group (school year start)."
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </SelectField>
        <TextField label="Rate limit (emails per minute)" type="number" min={1} value={ratePerMinute} onChange={(e) => setRatePerMinute(e.target.value)} error={errors.ratePerMinute} />
        <TextField label="Recipient cap per rolling 24 h" type="number" min={1} value={dailyRecipientCap} onChange={(e) => setDailyRecipientCap(e.target.value)} error={errors.dailyRecipientCap} hint="To and CC both count." />
      </div>
      <TextField label="Logo URL" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} error={errors.logoUrl} hint="Shown in the shared email layout." />
      <TextAreaField label="Footer (HTML)" rows={4} className="font-mono" value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} hint="Wraps every email together with the unsubscribe link. Include a link to your privacy notice." />
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
