"use client";

import { useId } from "react";
import type { Placeholder } from "@/lib/types";

interface Props {
  placeholders: Placeholder[];
  onInsert: (token: string) => void;
  label?: string;
}

const VARIABLE_KEY = /^[A-Za-z0-9_]{1,50}$/;

/** Resolves a picked key into a token; generic keys like tournament.vars.<key> ask for the name. */
function toToken(key: string): string | null {
  if (!key.includes("<")) return `{{${key}}}`;
  const name = window.prompt("Variable name (letters, digits, _), e.g. venue")?.trim();
  if (!name || !VARIABLE_KEY.test(name)) return null;
  return `{{${key.replace(/<[^>]+>/, name)}}}`;
}

/** Select that inserts a {{placeholder}} token; resets itself after each pick. */
export function PlaceholderPicker({ placeholders, onInsert, label = "Insert placeholder" }: Props) {
  const id = useId();
  return (
    <div className="min-w-0 shrink-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          const token = e.target.value ? toToken(e.target.value) : null;
          if (token) onInsert(token);
        }}
        className="w-44 max-w-full truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
        disabled={placeholders.length === 0}
      >
        <option value="">{label}…</option>
        {placeholders.map((p) => (
          <option key={p.key} value={p.key}>
            {`{{${p.key}}}`} — {p.description}
          </option>
        ))}
      </select>
    </div>
  );
}
