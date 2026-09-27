"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { useListQuery } from "@/lib/list-query";
import { useListData } from "@/lib/use-list-data";
import type { Participation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AddParticipationDialog } from "./add-participation-dialog";
import { ParticipationsGanttPanel, useGanttData } from "./participations-gantt-panel";
import { ParticipationsTable } from "./participations-table";
import { useParticipationActions } from "./use-participation-actions";

const T = {
  title: "Participations",
  description: "Where every team stands in each tournament's process: sign-up, payment, SportsEngine, staff calendar, roster, waivers.",
  view: "View",
  table: "Table",
  gantt: "Gantt",
  add: "Add participation",
};

type View = "table" | "gantt";
const VIEW_PARAM = "view";

/** Table | Gantt toggle, stored in the URL next to the (shared) list filters. */
function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div role="group" aria-label={T.view} className="inline-flex overflow-hidden rounded-md border border-slate-300">
      {(["table", "gantt"] as View[]).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn("px-3 py-2 text-sm font-medium", view === v ? "bg-brand-primary text-white" : "bg-white text-slate-800 hover:bg-slate-50")}
        >
          {v === "table" ? T.table : T.gantt}
        </button>
      ))}
    </div>
  );
}

export function ParticipationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: View = searchParams.get(VIEW_PARAM) === "gantt" ? "gantt" : "table";
  const list = useListQuery();
  // Only the visible view is fetched; both use the same URL filters.
  const tableData = useListData<Participation>("/participations", list, undefined, view === "table");
  const ganttData = useGanttData(list, view === "gantt");
  const reload = view === "table" ? tableData.reload : ganttData.reload;
  const { actions, dialogs, timeZone } = useParticipationActions(reload);
  const [adding, setAdding] = useState(false);

  function setView(next: View) {
    const params = new URLSearchParams(window.location.search);
    if (next === "gantt") params.set(VIEW_PARAM, "gantt");
    else params.delete(VIEW_PARAM);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const toggle = <ViewToggle view={view} onChange={setView} />;

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={<Button onClick={() => setAdding(true)}>{T.add}</Button>} />
      {view === "table" ? (
        <ParticipationsTable list={list} result={tableData} actions={actions} toolbarActions={toggle} />
      ) : (
        <ParticipationsGanttPanel list={list} result={ganttData} actions={actions} timeZone={timeZone} toolbarActions={toggle} />
      )}
      {dialogs}
      <AddParticipationDialog open={adding} onClose={() => setAdding(false)} onAdded={reload} />
    </>
  );
}
