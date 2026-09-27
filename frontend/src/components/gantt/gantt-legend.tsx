import type { ReactNode } from "react";
import type { StepState } from "@/lib/types";
import { COLORS, EnvelopeShape, MarkerShape } from "./gantt-marks";

const MARKERS: { state: StepState; label: string }[] = [
  { state: "DONE", label: "Done" },
  { state: "NEXT", label: "Next step" },
  { state: "OVERDUE", label: "Overdue" },
  { state: "UPCOMING", label: "Upcoming" },
];

const T = {
  legend: "Legend",
  completed: "Actual completion date",
  tournament: "Tournament dates",
  today: "Today",
  withdrawn: "Withdrawn (faded)",
  nextEmail: "Next planned email",
};

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={24} height={16} viewBox="-12 -8 24 16" className="shrink-0">
      {children}
    </svg>
  );
}

export function GanttLegend() {
  return (
    <ul aria-label={T.legend} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      {MARKERS.map((m) => (
        <li key={m.state} className="flex items-center gap-1">
          <Swatch>
            <MarkerShape state={m.state} />
          </Swatch>
          {m.label}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <Swatch>
          <line x1={0} x2={0} y1={-7} y2={7} stroke={COLORS.completed} strokeWidth={2} strokeLinecap="round" />
        </Swatch>
        {T.completed}
      </li>
      <li className="flex items-center gap-1">
        <Swatch>
          <rect x={-10} y={-5} width={20} height={10} rx={3} fill={COLORS.bar} stroke={COLORS.barStroke} />
        </Swatch>
        {T.tournament}
      </li>
      <li className="flex items-center gap-1">
        <Swatch>
          <line x1={0} x2={0} y1={-8} y2={8} stroke="currentColor" className="text-brand-primary" strokeWidth={2} />
        </Swatch>
        {T.today}
      </li>
      <li className="flex items-center gap-1">
        <Swatch>
          <EnvelopeShape />
        </Swatch>
        {T.nextEmail}
      </li>
      <li className="flex items-center gap-1">
        <Swatch>
          <MarkerShape state="WITHDRAWN" />
        </Swatch>
        {T.withdrawn}
      </li>
    </ul>
  );
}
