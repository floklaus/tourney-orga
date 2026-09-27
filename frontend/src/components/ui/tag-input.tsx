"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { inputClass } from "./field";

const T = {
  remove: (tag: string) => `Remove ${tag}`,
  help: "Press Enter or comma to add.",
};

interface Props {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
}

/** Free-text chips (trimmed, unique, case-insensitive). Enter/comma adds, Backspace on empty removes the last. */
export function TagInput({ label, value, onChange, placeholder, hint }: Props) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
    const next = [...value];
    tags.forEach((tag) => {
      if (!next.some((t) => t.toLowerCase() === tag.toLowerCase())) next.push(tag);
    });
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Enter") {
      event.preventDefault();
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={label}>
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-900 ring-1 ring-inset ring-neutral-300">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={T.remove(tag)}
                className="-mr-1 rounded-full px-1 text-sm leading-none hover:bg-neutral-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        className={inputClass}
      />
      <p id={`${id}-hint`} className="text-xs text-slate-600">
        {hint ? `${hint} ` : ""}
        {T.help}
      </p>
    </div>
  );
}
