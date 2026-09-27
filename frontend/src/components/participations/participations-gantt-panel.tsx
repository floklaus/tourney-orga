"use client";

import type { ReactNode } from "react";
import { todayIn } from "@/lib/days";
import { MAX_LIMIT, type ListState } from "@/lib/list-query";
import type { QueryResult } from "@/lib/use-api";
import { useListData } from "@/lib/use-list-data";
import { useNow } from "@/lib/use-now";
import type { Paginated, Participation } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ListToolbar } from "@/components/data-table/list-toolbar";
import { ParticipationGantt } from "@/components/gantt/participation-gantt";
import { PARTICIPATION_SEARCH_PLACEHOLDER } from "./participations-table";
import type { ParticipationActions } from "./use-participation-actions";

const T = {
  empty: "Nothing to show",
  emptyHint: "No participations match. Change the filters or add teams to a tournament.",
  clearAll: "Clear all filters",
  truncated: (shown: number, total: number) =>
    `Showing the first ${shown} of ${total} participations. Narrow the filters to see the rest.`,
};

/** The filtered participations for the Gantt chart: first page with the maximum size. */
export function useGanttData(list: ListState, enabled = true): QueryResult<Paginated<Participation>> {
  return useListData<Participation>("/participations", list, { page: 1, limit: MAX_LIMIT }, enabled);
}

interface Props {
  list: ListState;
  result: QueryResult<Paginated<Participation>>;
  actions: ParticipationActions;
  timeZone: string;
  /** Render the search/filter toolbar (off when the page shows a table with the same filters). */
  withToolbar?: boolean;
  toolbarActions?: ReactNode;
}

/** Gantt view of the filtered participations (same URL filters as the table, up to MAX_LIMIT rows). */
export function ParticipationsGanttPanel({ list, result, actions, timeZone, withToolbar = true, toolbarActions }: Props) {
  const now = useNow();
  const today = todayIn(now, timeZone);
  const { data, error, loading, reload } = result;

  let body: ReactNode;
  if (error && !data) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data) body = <LoadingState />;
  else if (data.items.length === 0)
    body = (
      <EmptyState
        title={T.empty}
        description={T.emptyHint}
        action={Object.keys(list.query.filters).length > 0 || list.query.search ? <Button variant="secondary" onClick={list.clearFilters}>{T.clearAll}</Button> : undefined}
      />
    );
  else
    body = (
      <div aria-busy={loading} className="space-y-3">
        {error && <ErrorAlert error={error} />}
        {data.meta.total > data.items.length && <Alert tone="warning">{T.truncated(data.items.length, data.meta.total)}</Alert>}
        <ParticipationGantt participations={data.items} today={today} timeZone={timeZone} onOpen={actions.open} />
      </div>
    );

  return (
    <div className="space-y-3">
      {withToolbar && <ListToolbar list={list} meta={data?.meta} searchPlaceholder={PARTICIPATION_SEARCH_PLACEHOLDER} actions={toolbarActions} />}
      {body}
    </div>
  );
}
