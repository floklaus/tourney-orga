"use client";

import { useMemo } from "react";
import { api } from "./api";
import { toApiParams, type ListQuery, type ListState } from "./list-query";
import { useApi, type QueryResult } from "./use-api";
import type { Paginated } from "./types";

/**
 * Fetches one page of a generic list endpoint for the given list state.
 * `paging` overrides page/limit, e.g. `{ page: 1, limit: MAX_LIMIT }` for the Gantt chart.
 */
export function useListData<T>(
  path: string,
  list: ListState,
  paging?: Partial<Pick<ListQuery, "page" | "limit">>,
  /** false skips the request (e.g. for a hidden view). */
  enabled = true,
): QueryResult<Paginated<T>> {
  const page = paging?.page;
  const limit = paging?.limit;
  const params = useMemo(
    () => (page === undefined && limit === undefined ? list.params : toApiParams(list.query, list.locked, { page, limit })),
    [list.params, list.query, list.locked, page, limit],
  );
  const qs = params.toString();
  return useApi(enabled ? `list:${path}?${qs}` : null, () => api.list<T>(path, params));
}
