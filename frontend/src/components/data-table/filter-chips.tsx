"use client";

import type { Facet, ListFilters, ListState } from "@/lib/list-query";

const T = {
  label: "Active filters",
  remove: (facet: string, value: string) => `Remove filter ${facet}: ${value}`,
  locked: "fixed on this page",
  defaultFilter: "Default filter. Choose other values in the filter menu to change it.",
  search: "Search",
  clearAll: "Clear all",
};

interface Chip {
  key: string;
  value: string;
  facetLabel: string;
  valueLabel: string;
  kind: "user" | "locked" | "default";
}

function labelsOf(facets: Facet[], key: string, value: string): { facetLabel: string; valueLabel: string } {
  const facet = facets.find((f) => f.key === key);
  return {
    facetLabel: facet?.label ?? key,
    valueLabel: facet?.options.find((o) => o.value === value)?.label ?? value,
  };
}

function buildChips(facets: Facet[], user: ListFilters, locked: ListFilters, effective: ListFilters): Chip[] {
  const chips: Chip[] = [];
  const push = (filters: ListFilters, kind: Chip["kind"]) =>
    Object.entries(filters).forEach(([key, values]) =>
      values.forEach((value) => chips.push({ key, value, kind, ...labelsOf(facets, key, value) })),
    );
  push(locked, "locked");
  push(user, "user");
  // Server defaults (e.g. teams archived=false) are shown, but can only be changed via the dropdown.
  const defaults = Object.fromEntries(
    Object.entries(effective).filter(([key]) => !(key in user) && !(key in locked)),
  );
  push(defaults, "default");
  return chips;
}

const chipBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function FilterChips({ list, facets, effective }: { list: ListState; facets: Facet[]; effective: ListFilters }) {
  const chips = buildChips(facets, list.query.filters, list.locked, effective);
  const search = list.query.search.trim();
  const canClear = search !== "" || Object.keys(list.query.filters).length > 0;
  if (chips.length === 0 && !search) return null;

  function remove(chip: Chip) {
    const values = (list.query.filters[chip.key] ?? []).filter((v) => v !== chip.value);
    list.setFilter(chip.key, values);
  }

  return (
    <div role="group" aria-label={T.label} className="flex flex-wrap items-center gap-1.5">
      {search && (
        <span className={`${chipBase} bg-slate-100 text-slate-800 ring-slate-300`}>
          {T.search}: “{search}”
        </span>
      )}
      {chips.map((chip) => {
        const text = `${chip.facetLabel}: ${chip.valueLabel}`;
        if (chip.kind === "user") {
          return (
            <span key={`${chip.kind}:${chip.key}:${chip.value}`} className={`${chipBase} bg-brand-orange-soft text-brand-ink ring-brand-orange-muted`}>
              {text}
              <button
                type="button"
                onClick={() => remove(chip)}
                aria-label={T.remove(chip.facetLabel, chip.valueLabel)}
                className="-mr-1 rounded-full px-1 text-sm leading-none hover:bg-brand-orange-muted"
              >
                ×
              </button>
            </span>
          );
        }
        return (
          <span
            key={`${chip.kind}:${chip.key}:${chip.value}`}
            className={`${chipBase} bg-slate-100 text-slate-800 ring-slate-300`}
            title={chip.kind === "default" ? T.defaultFilter : undefined}
          >
            {chip.kind === "locked" && (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                <path d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" />
              </svg>
            )}
            {text}
            {chip.kind === "locked" && <span className="sr-only"> ({T.locked})</span>}
          </span>
        );
      })}
      {canClear && (
        <button type="button" onClick={list.clearFilters} className="rounded px-2 py-0.5 text-xs font-medium text-brand-primary underline hover:bg-brand-orange-soft">
          {T.clearAll}
        </button>
      )}
    </div>
  );
}
