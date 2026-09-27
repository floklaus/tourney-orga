"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { formatDayRange, formatPlayDays } from "@/lib/days";
import { useApi } from "@/lib/use-api";
import type { ParticipationDetail, Tournament } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/page-header";
import { QueryView } from "@/components/ui/states";
import { EmailsSummary, NextStep, ParticipationStatusBadge } from "./participation-badges";
import { ParticipationEmails } from "./participation-emails";
import { ProcessStepsTable, StatusHistory } from "./participation-process";
import { ParticipationRowActions } from "./participation-row-actions";
import { ParticipationVariables } from "./participation-variables";
import { useParticipationActions } from "./use-participation-actions";

const T = {
  back: "← All participations",
  tournament: "Tournament",
  team: "Team",
  ageGroup: "Age group",
  days: "Days",
  calculated: (year: number, group: string) => `Class of ${year} · calculated ${group}`,
  next: "Next step",
  emails: "Emails",
  notes: "Notes",
  overview: "Overview",
};

export function ParticipationPage({ id }: { id: string }) {
  const detail = useApi(`participation:${id}`, () => api.get<ParticipationDetail>(`/participations/${id}`));
  return (
    <>
      <Link href="/participations" className="mb-2 inline-block text-sm font-medium text-brand-primary underline">
        {T.back}
      </Link>
      <QueryView {...detail} onRetry={detail.reload}>
        {(data) => <ParticipationView participation={data} reload={detail.reload} />}
      </QueryView>
    </>
  );
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}

function ParticipationView({ participation: p, reload }: { participation: ParticipationDetail; reload: () => void }) {
  const router = useRouter();
  const tournament = useApi(`tournament:${p.tournament.id}`, () => api.get<Tournament>(`/tournaments/${p.tournament.id}`));
  const { actions, dialogs, timeZone } = useParticipationActions(reload, () => router.replace(`/tournaments/${p.tournament.id}`));
  const refresh = () => {
    reload();
    tournament.reload();
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.team.name} <ParticipationStatusBadge participation={p} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/tournaments/${p.tournament.id}`} className="font-medium text-brand-primary underline">
              {p.tournament.name}
            </Link>
            <span>{formatDayRange(p.tournament.startDate, p.tournament.endDate)}</span>
            {p.ageGroup && <Badge tone="teal">{p.ageGroup}</Badge>}
          </span>
        }
        actions={<ParticipationRowActions participation={p} actions={actions} onDetailPage />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Remounts (refetching the emails) when variables or status change the participation version. */}
          <ParticipationEmails key={p.version} participation={p} onChanged={refresh} />
        </div>
        <div className="space-y-6">
          <Card title={T.overview}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label={T.team}>
                <Link href={`/teams/${p.team.id}`} className="text-brand-primary underline">
                  {p.team.name}
                </Link>
              </Item>
              <Item label={T.ageGroup}>
                {p.ageGroup ?? "—"}
                {p.team.graduationYear !== null && p.team.ageGroup && (
                  <span className="block text-xs text-slate-600">{T.calculated(p.team.graduationYear, p.team.ageGroup)}</span>
                )}
              </Item>
              <Item label={T.days}>{formatPlayDays(p.days, p.tournament.startDate, p.tournament.endDate)}</Item>
              <Item label={T.next}>
                <NextStep participation={p} />
              </Item>
              <Item label={T.emails}>
                <EmailsSummary participation={p} timeZone={timeZone} />
              </Item>
              {p.notes && (
                <Item label={T.notes} wide>
                  <span className="whitespace-pre-wrap">{p.notes}</span>
                </Item>
              )}
            </dl>
          </Card>
          <ParticipationVariables participation={p} tournamentValues={tournament.data?.variables} onSaved={refresh} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <ProcessStepsTable detail={p} timeZone={timeZone} />
        </Card>
        <Card>
          <StatusHistory detail={p} timeZone={timeZone} />
        </Card>
      </div>
      {dialogs}
    </>
  );
}
