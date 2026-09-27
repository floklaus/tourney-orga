"use client";

import { useId, type ReactNode } from "react";
import type { ListMeta, ListState } from "@/lib/list-query";
import { inputClass } from "@/components/ui/field";
import { FacetFilter } from "./facet-filter";
import { FilterChips } from "./filter-chips";

const T = {
  search: "Search",
  filters: "Filters",
};

interface Props {
  list: ListState;
  meta: ListMeta | undefined;
  searchPlaceholder?: string;
  /** Facet keys not offered as dropdowns. */
  hideFacets?: string[];
  /** Extra controls on the right, e.g. a view toggle. */
  actions?: ReactNode;
}

/** Search box, one multi-select dropdown per facet from `meta.facets`, and the active filter chips. */
export function ListToolbar({ list, meta, searchPlaceholder, hideFacets = [], actions }: Props) {
  const searchId = useId();
  const facets = meta?.facets ?? [];
  const effective = meta?.filters ?? list.query.filters;
  const dropdowns = facets.filter((f) => !(f.key in list.locked) && !hideFacets.includes(f.key));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-64">
          <label htmlFor={searchId} className="mb-1 block text-sm font-medium text-slate-800">
            {T.search}
          </label>
          <input
            id={searchId}
            type="search"
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            className={inputClass}
          />
        </div>
        {dropdowns.length > 0 && (
          <div role="group" aria-label={T.filters} className="flex flex-wrap gap-2">
            {dropdowns.map((facet) => (
              <FacetFilter
                key={facet.key}
                facet={facet}
                selected={list.query.filters[facet.key] ?? effective[facet.key] ?? []}
                onChange={(values) => list.setFilter(facet.key, values)}
              />
            ))}
          </div>
        )}
        {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
      </div>
      <FilterChips list={list} facets={facets} effective={effective} />
    </div>
  );
}
