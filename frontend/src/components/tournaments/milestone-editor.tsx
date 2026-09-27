"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { formatDay, isValidDay } from "@/lib/days";
import { describeMilestoneOffset, milestoneDueDate, milestoneOrderErrors, STATUS_LABELS } from "@/lib/participation";
import type { MilestoneAnchor, MilestoneInput, ProcessStatus } from "@/lib/types";

const T = {
  caption: "Participation timeline",
  step: "Step",
  offset: "Offset (days)",
  anchor: "Relative to",
  due: "Due date",
  start: "Tournament start",
  end: "Tournament end",
  offsetLabel: (label: string) => `${label}: offset in days`,
  anchorLabel: (label: string) => `${label}: relative to`,
  orderError: "Earlier than the previous step",
  orderHint: "Due dates must not decrease in process order.",
  noDates: "Enter the tournament dates to see the due dates.",
};

const INTEGER = /^-?\d+$/;

interface Props {
  value: MilestoneInput[];
  onChange: (milestones: MilestoneInput[]) => void;
  labels?: Partial<Record<ProcessStatus, string>>;
  /** With both dates the computed due dates are previewed and checked. */
  startDate?: string;
  endDate?: string;
  disabled?: boolean;
}

/** Offset + anchor per process step, in process order, with a due-date preview. */
export function MilestoneEditor({ value, onChange, labels = {}, startDate = "", endDate = "", disabled }: Props) {
  const [drafts, setDrafts] = useState<Partial<Record<ProcessStatus, string>>>({});
  const hasDates = isValidDay(startDate) && isValidDay(endDate);
  const errors = hasDates ? milestoneOrderErrors(value, startDate, endDate) : new Set<ProcessStatus>();

  function update(status: ProcessStatus, patch: Partial<MilestoneInput>) {
    onChange(value.map((m) => (m.status === status ? { ...m, ...patch } : m)));
  }

  function onOffset(status: ProcessStatus, raw: string) {
    setDrafts((d) => ({ ...d, [status]: raw }));
    if (INTEGER.test(raw.trim())) update(status, { offsetDays: Number(raw.trim()) });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">{T.caption}</caption>
          <thead className="bg-background-card text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
            <tr>
              <th scope="col" className="px-3 py-2">{T.step}</th>
              <th scope="col" className="px-3 py-2">{T.offset}</th>
              <th scope="col" className="px-3 py-2">{T.anchor}</th>
              <th scope="col" className="px-3 py-2">{T.due}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {value.map((m, index) => {
              const label = labels[m.status] ?? STATUS_LABELS[m.status];
              const invalid = errors.has(m.status);
              const draft = drafts[m.status] ?? String(m.offsetDays);
              return (
                <tr key={m.status} className={invalid ? "bg-red-50" : undefined}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                    <span className="mr-1 text-slate-500">{index + 1}.</span>
                    {label}
                  </th>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft}
                      onChange={(e) => onOffset(m.status, e.target.value)}
                      onBlur={() => setDrafts((d) => ({ ...d, [m.status]: undefined }))}
                      aria-label={T.offsetLabel(label)}
                      aria-invalid={!INTEGER.test(draft.trim()) || invalid || undefined}
                      disabled={disabled}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm aria-[invalid=true]:border-red-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.anchor}
                      onChange={(e) => update(m.status, { anchor: e.target.value as MilestoneAnchor })}
                      aria-label={T.anchorLabel(label)}
                      disabled={disabled}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="START">{T.start}</option>
                      <option value="END">{T.end}</option>
                    </select>
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2", invalid ? "font-medium text-red-800" : "text-slate-700")}>
                    {hasDates ? formatDay(milestoneDueDate(m, startDate, endDate)) : describeMilestoneOffset(m)}
                    {invalid && <span className="block text-xs">{T.orderError}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={cn("text-xs", errors.size > 0 ? "text-red-800" : "text-slate-600")} role={errors.size > 0 ? "alert" : undefined}>
        {hasDates || errors.size > 0 ? T.orderHint : T.noDates}
      </p>
    </div>
  );
}

/** Strips server-only fields so milestones can be sent back (PATCH/PUT). */
export function toMilestoneInputs(milestones: MilestoneInput[]): MilestoneInput[] {
  return milestones.map(({ status, offsetDays, anchor }) => ({ status, offsetDays, anchor }));
}

export function milestoneLabels(milestones: { status: ProcessStatus; label: string }[]): Partial<Record<ProcessStatus, string>> {
  return Object.fromEntries(milestones.map((m) => [m.status, m.label]));
}
