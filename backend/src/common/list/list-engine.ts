import { BadRequestException } from '@nestjs/common';
import { Paginated } from '../api-response';
import {
  Facet,
  FacetValue,
  ListFilter,
  ListMeta,
  ListSpec,
  SortValue,
} from './list-spec';

export interface ListQuery {
  search?: string;
  filter?: Record<string, unknown>;
  sort?: string;
  page: number;
  limit: number;
}

const BOOLEAN_OPTIONS: FacetValue[] = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Yes' },
];

const toFacetValue = (v: string | boolean | FacetValue): FacetValue =>
  typeof v === 'object' ? v : { value: String(v), label: String(v) };

/**
 * The generic list engine: search, multi-select filters (OR within a key, AND across keys),
 * facet counts, sorting and pagination over an in-memory collection.
 * Suitable for the club's data sizes (hundreds to a few thousand rows per resource).
 */
export function runListQuery<T>(
  items: T[],
  spec: ListSpec<T>,
  query: ListQuery,
): Paginated<T> & { meta: ListMeta } {
  const filters = parseFilters(spec, query.filter);
  const { key: sortKey, descending } = parseSort(spec, query.sort);
  const term = query.search?.trim().toLowerCase();
  const searched = term
    ? items.filter((item) =>
        spec.search(item).some((s) => s?.toLowerCase().includes(term)),
      )
    : items;

  const matches = (item: T, except?: string) =>
    spec.filters.every((f) => {
      const selected = filters[f.key];
      if (!selected || f.key === except) return true;
      return f
        .values(item)
        .some((v) => selected.includes(toFacetValue(v).value));
    });

  const filtered = searched.filter((item) => matches(item));
  const sortFn = spec.sorts[sortKey];
  const sorted = [...filtered].sort((a, b) =>
    compare(sortFn(a), sortFn(b), descending),
  );
  const start = (query.page - 1) * query.limit;

  const meta: ListMeta = {
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    sort: `${descending ? '-' : ''}${sortKey}`,
    filters,
    facets: spec.filters.map((f) =>
      buildFacet(
        f,
        searched.filter((item) => matches(item, f.key)),
        filters[f.key],
      ),
    ),
  };
  return new Paginated(
    sorted.slice(start, start + query.limit),
    meta,
  ) as Paginated<T> & { meta: ListMeta };
}

function parseFilters<T>(
  spec: ListSpec<T>,
  raw: Record<string, unknown> | undefined,
): Record<string, string[]> {
  const byKey = new Map(spec.filters.map((f) => [f.key, f]));
  const unknown = Object.keys(raw ?? {}).filter((k) => !byKey.has(k));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `Unknown filter(s): ${unknown.join(', ')}. Allowed: ${[...byKey.keys()].join(', ') || 'none'}`,
    );
  }
  const result: Record<string, string[]> = { ...(spec.defaultFilters ?? {}) };
  for (const [key, value] of Object.entries(raw ?? {})) {
    const values = (Array.isArray(value) ? value : [value])
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
    if (
      byKey.get(key)!.type === 'boolean' &&
      values.some((v) => v !== 'true' && v !== 'false')
    ) {
      throw new BadRequestException(
        `Filter "${key}" accepts only true or false`,
      );
    }
    if (values.length > 0) result[key] = [...new Set(values)];
    else delete result[key];
  }
  return result;
}

function parseSort<T>(
  spec: ListSpec<T>,
  raw: string | undefined,
): { key: string; descending: boolean } {
  const value = raw?.trim() || spec.defaultSort;
  const descending = value.startsWith('-');
  const key = descending ? value.slice(1) : value;
  if (!spec.sorts[key]) {
    throw new BadRequestException(
      `Unknown sort "${key}". Allowed: ${Object.keys(spec.sorts).join(', ')}`,
    );
  }
  return { key, descending };
}

function compare(a: SortValue, b: SortValue, descending: boolean): number {
  // Missing values always go last, regardless of direction.
  if (a === null || a === undefined)
    return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  const result =
    typeof x === 'string' && typeof y === 'string'
      ? x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true })
      : x < y
        ? -1
        : x > y
          ? 1
          : 0;
  return descending ? -result : result;
}

function buildFacet<T>(
  filter: ListFilter<T>,
  candidates: T[],
  selected: string[] | undefined,
): Facet {
  const counts = new Map<string, { label: string; count: number }>();
  const base =
    filter.type === 'boolean' ? BOOLEAN_OPTIONS : (filter.options ?? []);
  for (const option of base)
    counts.set(option.value, { label: option.label, count: 0 });
  for (const item of candidates) {
    // Count each item once per value, even if a value repeats.
    for (const v of new Map(
      filter
        .values(item)
        .map((raw) => [toFacetValue(raw).value, toFacetValue(raw)]),
    ).values()) {
      const entry = counts.get(v.value) ?? { label: v.label, count: 0 };
      counts.set(v.value, { label: entry.label, count: entry.count + 1 });
    }
  }
  for (const value of selected ?? []) {
    if (!counts.has(value)) counts.set(value, { label: value, count: 0 });
  }
  const options = [...counts.entries()].map(([value, { label, count }]) => ({
    value,
    label,
    count,
  }));
  // Enum/boolean options keep their declared order; data-driven ones are sorted by label.
  if (filter.type === 'ref' || filter.type === 'tag') {
    options.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  }
  return { key: filter.key, label: filter.label, type: filter.type, options };
}
