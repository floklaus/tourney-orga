"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { SendingMode, Settings } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

const T = {
  title: "Sending mode",
  intro: "Choose whether the app sends emails itself or prepares them for you to send from your own mail program.",
  automatic: "Automatic via Gmail",
  automaticText: "Due emails are sent by the server through the configured mailbox, within the rate limit and daily cap.",
  manual: "Manual – copy & send yourself",
  manualText:
    "When a step is due, one email per team is prepared as “ready to send”. You copy recipients, subject and body into your own mail program, send it, and mark it as sent here.",
  noMailbox: "Not available: no mailbox is configured on the server.",
  switchNote: "Switching to Manual turns emails that are still queued into “ready to send manually”.",
  save: "Save sending mode",
  saved: (mode: SendingMode) => (mode === "MANUAL" ? "Manual sending mode enabled." : "Automatic sending enabled."),
  saveError: "Could not change the sending mode",
};

interface Option {
  value: SendingMode;
  label: string;
  text: string;
}

const OPTIONS: Option[] = [
  { value: "AUTOMATIC", label: T.automatic, text: T.automaticText },
  { value: "MANUAL", label: T.manual, text: T.manualText },
];

export function SendingModeCard({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<SendingMode>(settings.sendingMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const available = settings.automaticSendingAvailable;
  const changed = mode !== settings.sendingMode;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.patch<Settings>("/settings", { sendingMode: mode });
      toast.show(T.saved(saved.sendingMode));
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={T.title}>
      <fieldset className="space-y-3">
        <legend className="text-sm text-slate-700">{T.intro}</legend>
        {OPTIONS.map((option) => {
          const disabled = option.value === "AUTOMATIC" && !available;
          return (
            <label
              key={option.value}
              className={cn(
                "flex gap-3 rounded-md border p-3 text-sm",
                mode === option.value ? "border-brand-primary bg-brand-orange-soft" : "border-slate-200",
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name="sendingMode"
                className="mt-0.5 accent-brand-primary"
                value={option.value}
                checked={mode === option.value}
                disabled={disabled}
                onChange={() => setMode(option.value)}
              />
              <span>
                <span className="block font-medium text-slate-900">{option.label}</span>
                <span className="block text-slate-700">{option.text}</span>
                {disabled && <span className="mt-1 block font-medium text-amber-900">{T.noMailbox}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {changed && mode === "MANUAL" ? (
        <Alert tone="info" className="mt-3">
          {T.switchNote}
        </Alert>
      ) : (
        available && settings.sendingMode === "AUTOMATIC" && <p className="mt-3 text-xs text-slate-600">{T.switchNote}</p>
      )}
      <ErrorAlert error={error} title={T.saveError} className="mt-3" />
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={busy} disabled={!changed}>
          {T.save}
        </Button>
      </div>
    </Card>
  );
}
