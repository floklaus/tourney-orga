"use client";

import Link from "next/link";
import { useAttention, useQuota, useSettings, useTimeZone } from "@/lib/queries";
import { useNow } from "@/lib/use-now";
import { Card, PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { useAttentionActions } from "@/components/queue/use-attention-actions";
import { SendingModeBadge } from "./sending-mode-badge";
import { NeedsAttentionCard } from "./needs-attention-card";
import { PauseBanner, QuotaWidget } from "./quota-widget";
import { UpcomingEmailsCard } from "./upcoming-emails";

const T = {
  title: "Dashboard",
  description: (tz: string) => `Times shown in ${tz} (settings timezone).`,
  quota: "Sending quota",
  quickActions: "Quick actions",
  links: [
    { href: "/tournaments", label: "Plan a tournament and its emails" },
    { href: "/participations", label: "Track participations" },
    { href: "/deliveries?filter[status]=READY", label: "Send ready emails" },
    { href: "/templates/new", label: "Write a template" },
    { href: "/teams", label: "Manage teams" },
  ],
};

export function DashboardPage() {
  const quota = useQuota();
  const settings = useSettings();
  const timeZone = useTimeZone();
  const nowMs = useNow();
  const sendingMode = settings.data?.sendingMode;
  const attention = useAttention();
  const { actions, dialogs } = useAttentionActions(() => quota.reload());

  return (
    <>
      <PageHeader title={T.title} description={T.description(timeZone)} actions={sendingMode && <SendingModeBadge mode={sendingMode} />} />
      {quota.data && (
        <PauseBanner
          quota={quota.data}
          onResumed={() => {
            quota.reload();
            attention.reload();
          }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <NeedsAttentionCard actions={actions} />
          <UpcomingEmailsCard timeZone={timeZone} nowMs={nowMs} />
        </div>
        <div className="space-y-6">
          <Card title={T.quota}>
            <QueryView {...quota} onRetry={quota.reload}>
              {(data) => <QuotaWidget quota={data} />}
            </QueryView>
          </Card>
          <Card title={T.quickActions}>
            <ul className="space-y-2 text-sm">
              {T.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-medium text-brand-primary underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      {dialogs}
    </>
  );
}
