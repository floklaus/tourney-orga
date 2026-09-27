"use client";

import { useMemo } from "react";
import { timeZoneOptions } from "@/lib/dates";
import { SelectField } from "./field";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Adds an empty option meaning "use the default". */
  defaultOptionLabel?: string;
  hint?: string;
}

export function TimezoneSelect({ label, value, onChange, defaultOptionLabel, hint }: Props) {
  const zones = useMemo(() => timeZoneOptions(value || undefined), [value]);
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)} hint={hint}>
      {defaultOptionLabel !== undefined && <option value="">{defaultOptionLabel}</option>}
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </SelectField>
  );
}
