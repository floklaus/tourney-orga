export type FacetType = 'enum' | 'ref' | 'boolean' | 'tag';

export interface FacetValue {
  value: string;
  label: string;
}

/**
 * A filterable field. `values` returns the item's value(s): plain strings/booleans for
 * enums and booleans, `{value, label}` pairs for refs and tags (labels come from the data).
 */
export interface ListFilter<T> {
  key: string;
  label: string;
  type: FacetType;
  /** All options for enums (shown even with count 0), in display order. */
  options?: FacetValue[];
  values: (item: T) => Array<string | boolean | FacetValue>;
}

/** Tag values whose label is the value itself. */
export const tags = (values: string[]): FacetValue[] =>
  values.map((v) => ({ value: v, label: v }));

export type SortValue = string | number | Date | null | undefined;

/** Declares how one resource is searched, filtered and sorted by the generic list engine. */
export interface ListSpec<T> {
  search: (item: T) => Array<string | null | undefined>;
  filters: ListFilter<T>[];
  sorts: Record<string, (item: T) => SortValue>;
  /** Sort key, optionally prefixed with "-" for descending. */
  defaultSort: string;
  /** Applied when the query does not mention that filter key. */
  defaultFilters?: Record<string, string[]>;
}

export interface FacetOption extends FacetValue {
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  type: FacetType;
  options: FacetOption[];
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  sort: string;
  filters: Record<string, string[]>;
  facets: Facet[];
}
