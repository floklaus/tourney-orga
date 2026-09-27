"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useSettings } from "@/lib/queries";
import type { AuthMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { DeliverabilityChecklist } from "./deliverability-checklist";
import { ParticipationDefaultsCard } from "./participation-defaults-card";
import { SendingModeCard } from "./sending-mode-card";
import { SettingsForm } from "./settings-form";

const AUTH_LABELS: Record<AuthMode, string> = {
  OAUTH2: "OAuth2 (XOAUTH2)",
  APP_PASSWORD: "App password",
  SMTP: "Generic SMTP",
  NONE: "None – no mailbox configured",
};

const T = {
  mailboxEnv: "The mailbox and its credentials are configured through environment variables on the server and cannot be changed here.",
  noMailbox: "No mailbox is configured on the server, so emails cannot be sent automatically. Use manual sending, or ask your server admin to configure a mailbox.",
  sendTest: "Send test email to me",
  testSent: "Test email sent to your address.",
  checklistManual: "Only relevant for automatic sending. In manual mode, emails are sent from your own mail program.",
};

export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    try {
      await api.post("/settings/test-email");
      toast.show(T.testSent);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Organizer details, sending limits and the shared email layout." />
      <QueryView {...settings} onRetry={settings.reload}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <SendingModeCard key={data.sendingMode} settings={data} onSaved={settings.reload} />
              <Card title="General">
                <SettingsForm settings={data} onSaved={settings.reload} />
              </Card>
              <ParticipationDefaultsCard />
            </div>
            <div className="space-y-6">
              <Card title="Mailbox">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-slate-800">Sender address</dt>
                    <dd className="break-all text-slate-700">{data.senderEmail || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-800">Authentication</dt>
                    <dd className="text-slate-700">{AUTH_LABELS[data.authMode] ?? data.authMode}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-600">{T.mailboxEnv}</p>
                {data.automaticSendingAvailable ? (
                  <Button variant="secondary" className="mt-4" onClick={sendTest} loading={testing}>
                    {T.sendTest}
                  </Button>
                ) : (
                  <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{T.noMailbox}</p>
                )}
              </Card>
              {data.automaticSendingAvailable && (
                <DeliverabilityChecklist note={data.sendingMode === "MANUAL" ? T.checklistManual : undefined} />
              )}
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}
