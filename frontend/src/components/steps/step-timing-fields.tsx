"use client";

import { useId } from "react";
import { formatDateTimeWithZone } from "@/lib/dates";
import { formatDay } from "@/lib/days";
import {
  describeRelative,
  estimateSendAt,
  fromTimingValue,
  validateTiming,
  type TimingErrors,
  type TimingValue,
  type TournamentDates,
} from "@/lib/email-timing";
import type { TimingAnchor } from "@/lib/types";
import { SelectField, TextField } from "@/components/ui/field";

const T = {
  legend: "Send time",
  absolute: "Fixed date and time",
  relative: "Relative to the tournament dates",
  dateTime: (tz: string) => `Date and time (${tz})`,
  offset: "Days",
  offsetHint: "Negative = before, e.g. -21.",
  time: (tz: string) => `Time of day (${tz})`,
  anchor: "Counted from",
  start: (day: string) => `Tournament start${day ? ` (${day})` : ""}`,
  end: (day: string) => `Tournament end${day ? ` (${day})` : ""}`,
  estimate: (text: string) => `→ ${text}`,
  perTeam: "The exact time is resolved per tournament.",
};

interface Props {
  value: TimingValue;
  onChange: (value: TimingValue) => void;
  timeZone: string;
  /** Used for the "→ 12 Mar 2026, 09:00" estimate; omitted e.g. before the tournament exists. */
  dates?: TournamentDates | null;
  errors: TimingErrors;
}

/** ABSOLUTE date/time, or RELATIVE offset days + time of day from the tournament start or end. */
export function StepTimingFields({ value, onChange, timeZone, dates, errors }: Props) {
  const name = useId();
  const set = (patch: Partial<TimingValue>) => onChange({ ...value, ...patch });
  const relativeValid = value.timingType === "RELATIVE" && Object.keys(validateTiming(value)).length === 0;
  const timing = relativeValid ? fromTimingValue(value, timeZone) : null;
  const estimate = timing ? estimateSendAt(timing, dates, timeZone) : null;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-800">{T.legend}</legend>
      <div className="flex flex-wrap gap-4">
        {(["RELATIVE", "ABSOLUTE"] as const).map((type) => (
          <label key={type} className="inline-flex items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name={name}
              className="accent-brand-primary"
              checked={value.timingType === type}
              onChange={() => set({ timingType: type })}
            />
            {type === "ABSOLUTE" ? T.absolute : T.relative}
          </label>
        ))}
      </div>

      {value.timingType === "ABSOLUTE" ? (
        <TextField
          label={T.dateTime(timeZone)}
          type="datetime-local"
          required
          value={value.sendAtLocal}
          onChange={(e) => set({ sendAtLocal: e.target.value })}
          error={errors.sendAtLocal}
        />
      ) : (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label={T.offset}
              type="number"
              step={1}
              required
              value={value.offsetDays}
              onChange={(e) => set({ offsetDays: e.target.value })}
              hint={T.offsetHint}
              error={errors.offsetDays}
            />
            <TextField
              label={T.time(timeZone)}
              type="time"
              required
              value={value.timeOfDay}
              onChange={(e) => set({ timeOfDay: e.target.value })}
              error={errors.timeOfDay}
            />
            <SelectField label={T.anchor} value={value.anchor} onChange={(e) => set({ anchor: e.target.value as TimingAnchor })}>
              <option value="START">{T.start(dates ? formatDay(dates.startDate) : "")}</option>
              <option value="END">{T.end(dates ? formatDay(dates.endDate) : "")}</option>
            </SelectField>
          </div>
          {timing && (
            <p className="text-sm text-slate-700" aria-live="polite">
              {describeRelative(timing.offsetDays, timing.timeOfDay, timing.anchor)}{" "}
              {estimate ? T.estimate(formatDateTimeWithZone(estimate, timeZone)) : <span className="text-slate-600">{T.perTeam}</span>}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
