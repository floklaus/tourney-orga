"use client";

// One list-query model for every list endpoint (api-contract v1.3 "Generic list API"):
// `search`, `filter[key]=a,b` (OR within a key, AND across keys), `sort=key|-key`, `page`, `limit`.
// The same serialization is used for the page URL (shareable, back button works) and for the API call.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageMeta } from "./types";

export type FacetType = "enum" | "ref" | "boolean" | "tag";

export interface FacetOption {
  value: string;
  label: string;
  /** Applies search and all OTHER filters (standard faceting). */
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  type: FacetType;
  options: FacetOption[];
}

export type ListFilters = Record<string, string[]>;

export interface ListMeta extends PageMeta {
  sort?: string;
  /** Effective filters, including server defaults (e.g. teams `archived=false`). */
  filters?: ListFilters;
  /** One per filter key, in display order. */
  facets?: Facet[];
}

export interface ListQuery {
  search: string;
  filters: ListFilters;
  /** "" = the resource's default sort. */
  sort: string;
  page: number;
  limit: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [25, 50, 100] as const;
/** Largest page the API serves; used by pickers and the Gantt chart. */
export const MAX_LIMIT = 500;
export const SEARCH_DEBOUNCE_MS = 300;

export const EMPTY_QUERY: ListQuery = { search: "", filters: {}, sort: "", page: 1, limit: DEFAULT_PAGE_SIZE };

const FILTER_PARAM = /^filter\[([^\]]+)\]$/;
const SCALAR_PARAMS = new Set(["search", "sort", "page", "limit"]);

export const filterParam = (key: string) => `filter[${key}]`;

const isListParam = (name: string) => SCALAR_PARAMS.has(name) || FILTER_PARAM.test(name);

function positiveInt(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
}

function uniqueValues(raw: string[]): string[] {
  const values = raw.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  return Array.from(new Set(values));
}

type ReadableParams = Pick<URLSearchParams, "get" | "getAll" | "keys">;

/** URL/API search params -> ListQuery. Unknown params (e.g. `view`) are ignored. */
export function parseListQuery(params: ReadableParams): ListQuery {
  const filters: ListFilters = {};
  for (const name of new Set(params.keys())) {
    const match = FILTER_PARAM.exec(name);
    if (!match) continue;
    const values = uniqueValues(params.getAll(name));
    if (values.length > 0) filters[match[1]] = values;
  }
  return {
    search: params.get("search") ?? "",
    filters,
    sort: params.get("sort") ?? "",
    page: positiveInt(params.get("page"), 1, Number.MAX_SAFE_INTEGER),
    limit: positiveInt(params.get("limit"), DEFAULT_PAGE_SIZE, MAX_LIMIT),
  };
}

function appendFilters(params: URLSearchParams, filters: ListFilters): void {
  Object.keys(filters)
    .sort()
    .forEach((key) => {
      const values = filters[key];
      if (values.length === 0) return;
      // Comma-joined is the canonical form; a value containing a comma falls back to repeated params.
      if (values.some((v) => v.includes(","))) values.forEach((v) => params.append(filterParam(key), v));
      else params.set(filterParam(key), values.join(","));
    });
}

/**
 * ListQuery -> search params, omitting defaults. Params of `base` that are not list params
 * (e.g. `view=gantt`) are kept.
 */
export function toSearchParams(query: ListQuery, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  base?.forEach((value, name) => {
    if (!isListParam(name)) params.append(name, value);
  });
  if (query.search.trim()) params.set("search", query.search.trim());
  appendFilters(params, query.filters);
  if (query.sort) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.limit !== DEFAULT_PAGE_SIZE) params.set("limit", String(query.limit));
  return params;
}

/** Params for the API call: the user's query plus filters that are fixed by the page. */
export function toApiParams(query: ListQuery, locked: ListFilters = {}, paging?: Partial<Pick<ListQuery, "page" | "limit">>): URLSearchParams {
  const params = toSearchParams({ ...query, ...paging, filters: { ...query.filters, ...locked } });
  if (!params.has("limit")) params.set("limit", String(paging?.limit ?? query.limit));
  return params;
}

/** Query string for the page URL, with readable `[`, `]` and `,` (still a valid URL). */
export function readableQueryString(params: URLSearchParams): string {
  let qs = params.toString().replace(/%5B/gi, "[").replace(/%5D/gi, "]");
  // Commas separate filter values; keep them encoded if a value itself contains one (repeated-param form).
  const repeated = Array.from(params.keys()).some((k, i, all) => all.indexOf(k) !== i);
  if (!repeated) qs = qs.replace(/%2C/gi, ",");
  return qs;
}

/** A link to a list page with the given filters, e.g. listHref("/participations", { tournament: [id] }). */
export function listHref(path: string, filters: ListFilters, extra: Partial<ListQuery> = {}): string {
  const qs = readableQueryString(toSearchParams({ ...EMPTY_QUERY, ...extra, filters }));
  return qs ? `${path}?${qs}` : path;
}

export interface ListState {
  /** The user's query (without locked filters). */
  query: ListQuery;
  /** Filters fixed by the page (shown as locked chips, not editable). */
  locked: ListFilters;
  /** Ready-to-send API params (query + locked). */
  params: URLSearchParams;
  /** Text in the search box; applied to `query.search` after a debounce. */
  searchInput: string;
  setSearchInput: (value: string) => void;
  setFilter: (key: string, values: string[]) => void;
  /** Clears all filters and the search. */
  clearFilters: () => void;
  setSort: (sort: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}

type Commit = (next: ListQuery, history: "push" | "replace") => void;

interface SearchBox {
  value: string;
  /** Last `query.search` seen, to notice external changes (back button, "Clear all"). */
  seen: string;
  /** Last search we committed ourselves. */
  written: string;
}

function useListController(current: ListQuery, commit: Commit, locked: ListFilters): ListState {
  const [box, setBox] = useState<SearchBox>({ value: current.search, seen: current.search, written: current.search });
  if (current.search !== box.seen) {
    const external = current.search !== box.written;
    setBox({
      value: external ? current.search : box.value,
      seen: current.search,
      written: external ? current.search : box.written,
    });
  }

  const latest = useRef({ current, commit });
  useEffect(() => {
    latest.current = { current, commit };
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setSearchInput = useCallback((value: string) => {
    setBox((b) => ({ ...b, value }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { current: now, commit: write } = latest.current;
      if (now.search === value) return;
      setBox((b) => ({ ...b, written: value }));
      write({ ...now, search: value, page: 1 }, "replace");
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const lockedKey = JSON.stringify(locked);
  const currentKey = JSON.stringify(current);
  const params = useMemo(() => toApiParams(JSON.parse(currentKey), JSON.parse(lockedKey)), [currentKey, lockedKey]);

  return {
    query: current,
    locked,
    params,
    searchInput: box.value,
    setSearchInput,
    setFilter: (key, values) => {
      const filters = { ...current.filters };
      if (values.length > 0) filters[key] = values;
      else delete filters[key];
      commit({ ...current, filters, page: 1 }, "push");
    },
    clearFilters: () => {
      clearTimeout(timer.current);
      commit({ ...current, search: "", filters: {}, page: 1 }, "push");
    },
    setSort: (sort) => commit({ ...current, sort, page: 1 }, "push"),
    setPage: (page) => commit({ ...current, page: Math.max(1, page) }, "push"),
    setLimit: (limit) => commit({ ...current, limit, page: 1 }, "push"),
  };
}

const NO_FILTERS: ListFilters = {};

/**
 * List state kept in the page URL. Requires a <Suspense> boundary above the page
 * (useSearchParams), see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md.
 */
export function useListQuery(locked: ListFilters = NO_FILTERS): ListState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const current = useMemo(() => parseListQuery(new URLSearchParams(qs)), [qs]);
  const commit = useCallback<Commit>(
    (next, history) => {
      const nextQs = readableQueryString(toSearchParams(next, new URLSearchParams(window.location.search)));
      const href = nextQs ? `${pathname}?${nextQs}` : pathname;
      if (history === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router],
  );
  return useListController(current, commit, locked);
}

/** Same as useListQuery, but kept in component state (for lists inside dialogs). */
export function useLocalListQuery(initial: Partial<ListQuery> = {}, locked: ListFilters = NO_FILTERS): ListState {
  const [current, setCurrent] = useState<ListQuery>(() => ({ ...EMPTY_QUERY, ...initial }));
  const commit = useCallback<Commit>((next) => setCurrent(next), []);
  return useListController(current, commit, locked);
}
