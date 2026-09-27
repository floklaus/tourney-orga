"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDayRange } from "@/lib/days";
import { useListQuery } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { Tournament } from "@/lib/types";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AgeGroupChips, StatusSummary, TimingBadge } from "./tournament-badges";
import { TournamentFormDialog } from "./tournament-form-dialog";

const T = {
  title: "Tournaments",
  description: "Tournaments your teams take part in, with the participation timeline (sign-up, payment, roster, waivers…).",
  add: "New tournament",
  empty: "No tournaments yet",
  emptyHint: "Create a tournament, then add the participating teams.",
  searchPlaceholder: "Name, description or website",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const COLUMNS: Column<Tournament>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    cell: (t) => (
      <>
        <Link href={`/tournaments/${t.id}`} className="font-medium text-brand-primary underline">
          {t.name}
        </Link>
        {t.url && <span className="block truncate text-xs text-slate-600">{hostOf(t.url)}</span>}
      </>
    ),
  },
  { id: "dates", header: "Dates", sortKey: "startDate", className: "whitespace-nowrap", cell: (t) => formatDayRange(t.startDate, t.endDate) },
  { id: "ageGroups", header: "Age groups", hideOnMobile: true, cell: (t) => <AgeGroupChips ageGroups={t.ageGroups} /> },
  { id: "timing", header: "Timing", cell: (t) => <TimingBadge timing={t.timing} /> },
  { id: "participants", header: "Teams", sortKey: "participantCount", align: "right", cell: (t) => t.participantCount },
  { id: "progress", header: "Progress", hideOnMobile: true, cell: (t) => <StatusSummary counts={t.statusCounts} /> },
];

export function TournamentsPage() {
  const router = useRouter();
  const list = useListQuery();
  const tournaments = useListData<Tournament>("/tournaments", list);
  const [createOpen, setCreateOpen] = useState(false);
  const addButton = <Button onClick={() => setCreateOpen(true)}>{T.add}</Button>;

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={addButton} />
      <DataTable
        caption={T.title}
        columns={COLUMNS}
        list={list}
        result={tournaments}
        rowKey={(t) => t.id}
        searchPlaceholder={T.searchPlaceholder}
        emptyTitle={T.empty}
        emptyDescription={T.emptyHint}
        emptyAction={addButton}
      />
      <TournamentFormDialog
        open={createOpen}
        tournament={null}
        onClose={() => setCreateOpen(false)}
        onSaved={(created) => router.push(`/tournaments/${created.id}`)}
      />
    </>
  );
}
