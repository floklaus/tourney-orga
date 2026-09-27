"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, pluralize } from "@/lib/format";
import type { ListState } from "@/lib/list-query";
import type { QueryResult } from "@/lib/use-api";
import type { Paginated } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button, Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ListPagination } from "./list-pagination";
import { ListToolbar } from "./list-toolbar";
import type { Column } from "./types";

export type { Column } from "./types";

const T = {
  noMatches: "Nothing matches these filters",
  noMatchesHint: "Change the search or remove some filters.",
  clearAll: "Clear all filters",
  updating: "Updating…",
  selectPage: "Select all rows on this page",
  selectRow: (label: string) => `Select ${label}`,
  selected: (n: number) => `${pluralize(n, "row")} selected`,
  selectAllOnPage: (n: number) => `Select all ${n} on this page`,
  clearSelection: "Clear selection",
  sortBy: (label: string) => `Sort by ${label}`,
};

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  list: ListState;
  result: QueryResult<Paginated<T>>;
  rowKey: (row: T) => string;
  /** Accessible name of a row, e.g. the team name (used for the selection checkbox). */
  rowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  searchPlaceholder?: string;
  hideFacets?: string[];
  toolbarActions?: ReactNode;
  emptyTitle: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Enables row selection; renders the actions for the selected rows. */
  bulkActions?: (selected: T[], clearSelection: () => void) => ReactNode;
}

/** Generic server-driven list: toolbar (search, facets, chips), sortable table, selection, pagination. */
export function DataTable<T>(props: DataTableProps<T>) {
  const { list, result, searchPlaceholder, hideFacets, toolbarActions } = props;
  return (
    <div className="space-y-3">
      <ListToolbar list={list} meta={result.data?.meta} searchPlaceholder={searchPlaceholder} hideFacets={hideFacets} actions={toolbarActions} />
      <DataTableBody {...props} />
    </div>
  );
}

function DataTableBody<T>({ list, result, emptyTitle, emptyDescription, emptyAction, ...rest }: DataTableProps<T>) {
  const { data, error, loading, reload } = result;
  if (error && data === undefined) return <ErrorState error={error} onRetry={reload} />;
  if (data === undefined) return <LoadingState />;
  const filtered = list.query.search.trim() !== "" || Object.keys(list.query.filters).length > 0;
  return (
    <div aria-busy={loading} className="space-y-3">
      {error && <ErrorAlert error={error} />}
      {loading && (
        <p role="status" className="flex items-center gap-2 text-xs text-slate-600">
          <Spinner className="h-3 w-3" /> {T.updating}
        </p>
      )}
      {data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title={T.noMatches}
            description={T.noMatchesHint}
            action={<Button variant="secondary" onClick={list.clearFilters}>{T.clearAll}</Button>}
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )
      ) : (
        <>
          <RowsTable rows={data.items} list={list} sort={list.query.sort || data.meta.sort || ""} {...rest} />
          <ListPagination meta={data.meta} count={data.items.length} onPage={list.setPage} onLimit={list.setLimit} />
        </>
      )}
    </div>
  );
}

type RowsProps<T> = Omit<DataTableProps<T>, "result" | "emptyTitle" | "emptyDescription" | "emptyAction"> & {
  rows: T[];
  /** Effective sort (the user's, else the server default). */
  sort: string;
};

function RowsTable<T>({ rows, sort, columns, list, caption, rowKey, rowLabel, rowClassName, bulkActions }: RowsProps<T>) {
  const [selected, setSelected] = useState<ReadonlyMap<string, T>>(new Map());
  const selectable = bulkActions !== undefined;
  const pageKeys = rows.map(rowKey);
  const selectedOnPage = pageKeys.filter((k) => selected.has(k)).length;
  const allOnPage = rows.length > 0 && selectedOnPage === rows.length;
  const clear = () => setSelected(new Map());

  function toggleRow(row: T) {
    const key = rowKey(row);
    const next = new Map(selected);
    if (next.has(key)) next.delete(key);
    else next.set(key, row);
    setSelected(next);
  }

  function togglePage() {
    const next = new Map(selected);
    if (allOnPage) pageKeys.forEach((k) => next.delete(k));
    else rows.forEach((row) => next.set(rowKey(row), row));
    setSelected(next);
  }

  const cellClass = (column: Column<T>) =>
    cn(column.className, column.hideOnMobile && "hidden md:table-cell", column.align === "right" && "text-right");

  return (
    <div className="space-y-2">
      {selectable && selected.size > 0 && (
        <div role="region" aria-label={T.selected(selected.size)} className="flex flex-wrap items-center gap-2 rounded-md border border-brand-orange-muted bg-brand-orange-soft px-3 py-2 text-sm text-brand-ink">
          <span className="font-medium">{T.selected(selected.size)}</span>
          {!allOnPage && (
            <Button size="sm" variant="ghost" onClick={togglePage}>
              {T.selectAllOnPage(rows.length)}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clear}>
            {T.clearSelection}
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">{bulkActions(Array.from(selected.values()), clear)}</div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-10 bg-background-card px-3 py-2">
                  <PageCheckbox checked={allOnPage} indeterminate={selectedOnPage > 0 && !allOnPage} onChange={togglePage} />
                </th>
              )}
              {columns.map((column) => (
                <HeaderCell key={column.id} column={column} sort={sort} onSort={list.setSort} className={cellClass(column)} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr key={key} className={cn(selected.has(key) && "bg-brand-orange-soft/60", rowClassName?.(row))}>
                  {selectable && (
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-brand-primary"
                        checked={selected.has(key)}
                        onChange={() => toggleRow(row)}
                        aria-label={T.selectRow(rowLabel?.(row) ?? key)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.id} className={cn("px-3 py-2 align-top text-slate-800", cellClass(column))}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="h-4 w-4 accent-brand-primary" checked={checked} onChange={onChange} aria-label={T.selectPage} />;
}

type SortDirection = "ascending" | "descending" | "none";

function directionOf(sort: string, key: string): SortDirection {
  if (sort === key) return "ascending";
  if (sort === `-${key}`) return "descending";
  return "none";
}

function HeaderCell<T>({ column, sort, onSort, className }: { column: Column<T>; sort: string; onSort: (sort: string) => void; className?: string }) {
  const base = cn("bg-background-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700", className);
  if (!column.sortKey) {
    return (
      <th scope="col" className={base}>
        {column.header}
      </th>
    );
  }
  const key = column.sortKey;
  const direction = directionOf(sort, key);
  return (
    <th scope="col" aria-sort={direction} className={base}>
      <button
        type="button"
        onClick={() => onSort(direction === "ascending" ? `-${key}` : key)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900"
        title={T.sortBy(typeof column.header === "string" ? column.header : key)}
      >
        {column.header}
        <span aria-hidden="true" className={direction === "none" ? "text-slate-400" : "text-brand-primary"}>
          {direction === "ascending" ? "▲" : direction === "descending" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}
