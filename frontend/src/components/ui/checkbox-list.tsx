"use client";

import { useId, useState } from "react";
import { inputClass } from "./field";

interface Option {
  id: string;
  name: string;
  hint?: string;
}

interface CheckboxListProps {
  legend: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchable?: boolean;
  emptyText?: string;
  hint?: string;
}

/** Accessible multi-select rendered as a scrollable list of checkboxes. */
export function CheckboxList({ legend, options, selected, onChange, searchable, emptyText = "Nothing to choose from.", hint }: CheckboxListProps) {
  const [filter, setFilter] = useState("");
  const searchId = useId();
  const visible = filter
    ? options.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()))
    : options;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">
        {legend}
        {selected.length > 0 && <span className="ml-1 font-normal text-slate-600">({selected.length} selected)</span>}
      </legend>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
      {searchable && options.length > 6 && (
        <div>
          <label htmlFor={searchId} className="sr-only">
            Filter {legend}
          </label>
          <input
            id={searchId}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className={inputClass}
          />
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-sm text-slate-600">{emptyText}</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
          {visible.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-primary"
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
              />
              <span className="text-slate-900">{option.name}</span>
              {option.hint && <span className="text-xs text-slate-600">{option.hint}</span>}
            </label>
          ))}
          {visible.length === 0 && <p className="px-1 text-sm text-slate-600">No matches.</p>}
        </div>
      )}
    </fieldset>
  );
}
