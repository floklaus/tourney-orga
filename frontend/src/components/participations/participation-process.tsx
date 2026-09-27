"use client";

import { formatDateTime } from "@/lib/dates";
import { dayNumber, dayOfInstant, formatDay } from "@/lib/days";
import { cn, fullName } from "@/lib/format";
import { statusLabel } from "@/lib/participation";
import type { ParticipationDetail } from "@/lib/types";
import { StepStateBadge } from "./participation-badges";

const T = {
  steps: "Process steps",
  step: "Step",
  due: "Due",
  completed: "Completed",
  state: "State",
  history: "Status history",
  noHistory: "No status changes yet.",
  created: "Added",
  by: (name: string) => `by ${name}`,
  late: (days: number) => `${days} ${days === 1 ? "day" : "days"} late`,
};

function lateDays(due: string, completedDay: string): number {
  return dayNumber(completedDay) - dayNumber(due);
}

export function ProcessStepsTable({ detail, timeZone }: { detail: ParticipationDetail; timeZone: string }) {
  return (
    <section aria-labelledby="participation-steps">
      <h2 id="participation-steps" className="mb-2 text-base font-semibold text-slate-900">
        {T.steps}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-background-card text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
            <tr>
              <th scope="col" className="px-3 py-2">{T.step}</th>
              <th scope="col" className="px-3 py-2">{T.due}</th>
              <th scope="col" className="px-3 py-2">{T.completed}</th>
              <th scope="col" className="px-3 py-2">{T.state}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detail.steps.map((step, i) => {
              const completedDay = step.completedAt ? dayOfInstant(step.completedAt, timeZone) : "";
              const late = completedDay ? lateDays(step.dueDate, completedDay) : 0;
              return (
                <tr key={step.status} className={cn(step.state === "WITHDRAWN" && "text-slate-500")}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                    <span className="mr-1 text-slate-500">{i + 1}.</span>
                    {step.label}
                  </th>
                  <td className={cn("whitespace-nowrap px-3 py-2", step.state === "OVERDUE" && "font-semibold text-red-800")}>{formatDay(step.dueDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {completedDay ? formatDay(completedDay) : "—"}
                    {late > 0 && <span className="block text-xs text-amber-900">{T.late(late)}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StepStateBadge state={step.state} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatusHistory({ detail, timeZone }: { detail: ParticipationDetail; timeZone: string }) {
  const history = [...detail.history].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  return (
    <section aria-labelledby="participation-history">
      <h2 id="participation-history" className="mb-2 text-base font-semibold text-slate-900">
        {T.history}
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-slate-600">{T.noHistory}</p>
      ) : (
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm">
          {history.map((change) => (
            <li key={change.id}>
              <p className="text-slate-900">
                {change.fromStatus ? `${statusLabel(change.fromStatus, detail)} → ` : `${T.created}: `}
                <strong>{statusLabel(change.toStatus, detail)}</strong>
              </p>
              <p className="text-xs text-slate-600">
                <time dateTime={change.changedAt}>{formatDateTime(change.changedAt, timeZone)}</time>
                {change.changedBy && ` · ${T.by(fullName(change.changedBy))}`}
              </p>
              {change.note && <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{change.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
