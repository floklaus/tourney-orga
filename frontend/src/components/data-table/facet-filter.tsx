"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/format";
import type { Facet } from "@/lib/list-query";
import { inputClass } from "@/components/ui/field";
import { usePopover } from "@/components/ui/popover";

/** Long option lists get a search box inside the dropdown. */
const SEARCH_THRESHOLD = 8;

const T = {
  filterBy: (label: string) => `Filter by ${label}`,
  search: (label: string) => `Search ${label} options`,
  selected: (n: number) => `${n} selected`,
  clear: "Clear",
  done: "Done",
  noOptions: "No options.",
  noMatches: "No matches.",
};

interface Props {
  facet: Facet;
  selected: string[];
  onChange: (values: string[]) => void;
}

/** Multi-select dropdown for one facet: checkboxes with counts (OR within the facet). */
export function FacetFilter({ facet, selected, onChange }: Props) {
  const { open, toggle, close, rootRef, triggerRef, onRootKeyDown, onRootBlur } = usePopover();
  const [term, setTerm] = useState("");
  const panelId = useId();
  const showSearch = facet.options.length > SEARCH_THRESHOLD;
  const needle = term.trim().toLowerCase();
  const visible = needle ? facet.options.filter((o) => o.label.toLowerCase().includes(needle)) : facet.options;

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onRootKeyDown} onBlur={onRootBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium",
          selected.length > 0
            ? "border-brand-primary bg-brand-orange-soft text-brand-ink"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        )}
      >
        {facet.label}
        {selected.length > 0 && (
          <span className="rounded-full bg-brand-primary px-1.5 text-xs font-semibold text-white">
            <span aria-hidden="true">{selected.length}</span>
            <span className="sr-only">, {T.selected(selected.length)}</span>
          </span>
        )}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={T.filterBy(facet.label)}
          className="absolute left-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          {showSearch && (
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label={T.search(facet.label)}
              placeholder="Search…"
              className={cn(inputClass, "mb-2")}
              autoFocus
            />
          )}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {visible.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-primary"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                      autoFocus={!showSearch && option === visible[0]}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-900" title={option.label}>
                      {option.label}
                    </span>
                    <span className={cn("text-xs tabular-nums", option.count === 0 ? "text-slate-500" : "text-slate-700")}>
                      {option.count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p className="px-1.5 py-1 text-sm text-slate-600">{facet.options.length === 0 ? T.noOptions : T.noMatches}</p>
          )}
          <div className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="rounded px-2 py-1 text-sm font-medium text-brand-primary hover:bg-brand-orange-soft disabled:text-slate-400"
            >
              {T.clear}
            </button>
            <button
              type="button"
              onClick={() => close()}
              className="rounded bg-brand-primary px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-primary-hover"
            >
              {T.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
