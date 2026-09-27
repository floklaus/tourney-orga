"use client";

import { useId } from "react";
import { daysBetween, formatWeekday } from "@/lib/days";
import { cn } from "@/lib/format";

const T = {
  legend: "Days",
  hint: "The tournament days this team plays on.",
  all: "All days",
  single: "Single-day tournament.",
  required: "Choose at least one day.",
};

interface Props {
  startDate: string;
  endDate: string;
  value: string[];
  onChange: (days: string[]) => void;
  /** Shows the "at least one" error once the form was submitted. */
  showError?: boolean;
}

/** Toggle buttons for the days of a tournament (at least one must stay chosen). */
export function DayPicker({ startDate, endDate, value, onChange, showError }: Props) {
  const hintId = useId();
  const days = daysBetween(startDate, endDate);
  if (days.length <= 1) {
    return (
      <div className="text-sm">
        <span className="font-medium text-slate-900">{T.legend}</span>
        <p className="text-xs text-slate-600">
          {formatWeekday(days[0])} · {T.single}
        </p>
      </div>
    );
  }
  const allChosen = days.every((d) => value.includes(d));
  const toggle = (day: string) => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  const error = showError && value.length === 0;
  return (
    <fieldset className="space-y-2" aria-describedby={hintId}>
      <legend className="text-sm font-medium text-slate-900">{T.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {days.map((day) => {
          const pressed = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(day)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                pressed ? "border-brand-primary bg-brand-primary text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
              )}
            >
              {formatWeekday(day)}
            </button>
          );
        })}
        {!allChosen && (
          <button type="button" onClick={() => onChange(days)} className="px-2 text-sm font-medium text-brand-primary underline">
            {T.all}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {T.required}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-slate-600">
          {T.hint}
        </p>
      )}
    </fieldset>
  );
}
