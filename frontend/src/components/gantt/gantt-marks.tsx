// SVG marks of the Gantt chart. Each state has its own shape as well as color (never color alone).
import { memo, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { StepState } from "@/lib/types";
import type { MarkerModel, RowModel } from "./gantt-model";

export const ROW_HEIGHT = 32;
const MID = ROW_HEIGHT / 2;

export const COLORS = {
  done: "#15803d",
  next: "#ea8c32",
  nextRing: "#5c3007",
  overdue: "#b91c1c",
  upcoming: "#64748b",
  withdrawn: "#94a3b8",
  line: "#cbd5e1",
  bar: "#f5cfa6",
  barStroke: "#ea8c32",
  completed: "#166534",
  email: "#a8570f",
  surface: "#ffffff",
};

/** One marker shape at (0,0); used in rows and in the legend. */
export function MarkerShape({ state }: { state: StepState }) {
  switch (state) {
    case "DONE":
      return (
        <>
          <circle r={6} fill={COLORS.done} stroke={COLORS.surface} strokeWidth={2} />
          <path d="M-3 0.2 L-0.8 2.4 L3 -2" fill="none" stroke={COLORS.surface} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "NEXT":
      return <circle r={6} fill={COLORS.next} stroke={COLORS.nextRing} strokeWidth={2} />;
    case "OVERDUE":
      return (
        <>
          <rect x={-5.5} y={-5.5} width={11} height={11} transform="rotate(45)" fill={COLORS.overdue} stroke={COLORS.surface} strokeWidth={1.5} />
          <path d="M0 -3 V0.8 M0 2.6 V2.7" stroke={COLORS.surface} strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
    case "WITHDRAWN":
      return <circle r={5} fill={COLORS.surface} stroke={COLORS.withdrawn} strokeWidth={1.5} strokeDasharray="2 2" />;
    default:
      return <circle r={5} fill={COLORS.surface} stroke={COLORS.upcoming} strokeWidth={1.5} />;
  }
}

/** Small envelope for the next planned email, centred at (0,0). */
export function EnvelopeShape() {
  return (
    <>
      <rect x={-5} y={-3.5} width={10} height={7} rx={1} fill={COLORS.surface} stroke={COLORS.email} strokeWidth={1.3} />
      <path d="M-4.5 -3 L0 0.6 L4.5 -3" fill="none" stroke={COLORS.email} strokeWidth={1.1} strokeLinejoin="round" />
    </>
  );
}

export type TipHandler = (target: Element | null, text: string) => void;

interface RowProps {
  row: RowModel;
  width: number;
  onOpen: (row: RowModel) => void;
  onTip: TipHandler;
}

/** Tab stop of a row: the next/overdue marker, else the first one. */
function focusIndex(markers: MarkerModel[]): number {
  const index = markers.findIndex((m) => m.state === "NEXT" || m.state === "OVERDUE");
  return index < 0 ? 0 : index;
}

function onMarkerKeys(event: KeyboardEvent<SVGSVGElement>, open: () => void) {
  const markers = Array.from(event.currentTarget.querySelectorAll<SVGGElement>("[data-marker]"));
  const index = markers.indexOf(document.activeElement as SVGGElement);
  if (index < 0) return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    const next = markers[index + (event.key === "ArrowRight" ? 1 : -1)];
    next?.focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    open();
  }
}

/** Timeline of one participation: first milestone → tournament end, tournament bar, 8 milestones. */
export const GanttRowChart = memo(function GanttRowChart({ row, width, onOpen, onTip }: RowProps) {
  const tabIndex = focusIndex(row.markers);
  const team = row.participation.team.name;
  const show = (event: PointerEvent<SVGGElement> | FocusEvent<SVGGElement>, marker: MarkerModel) =>
    onTip(event.currentTarget, `${row.label}\n${marker.text}`);
  const hide = () => onTip(null, "");
  return (
    <svg
      width={width}
      height={ROW_HEIGHT}
      className="block overflow-visible"
      onKeyDown={(e) => onMarkerKeys(e, () => onOpen(row))}
      opacity={row.withdrawn ? 0.5 : 1}
    >
      <line x1={row.lineFrom} x2={row.barEnd} y1={MID} y2={MID} stroke={COLORS.line} strokeWidth={2} />
      <rect x={row.barStart} y={MID - 6} width={Math.max(2, row.barEnd - row.barStart)} height={12} rx={3} fill={COLORS.bar} stroke={COLORS.barStroke} strokeWidth={1} />
      {row.nextEmail && (
        // Decorative: the row button's accessible name already includes the next email date.
        <g aria-hidden="true" transform={`translate(${row.nextEmail.x} 5)`}>
          <title>{row.nextEmail.text}</title>
          <EnvelopeShape />
        </g>
      )}
      {row.markers.map((m, i) => (
        <g key={m.status}>
          {m.completedX !== null && (
            <line x1={m.completedX} x2={m.completedX} y1={MID - 9} y2={MID + 9} stroke={COLORS.completed} strokeWidth={2} strokeLinecap="round" />
          )}
          <g
            data-marker=""
            role="button"
            tabIndex={i === tabIndex ? 0 : -1}
            aria-label={`${team}: ${m.text}`}
            transform={`translate(${m.x} ${MID})`}
            className="cursor-pointer"
            onPointerEnter={(e) => show(e, m)}
            onPointerLeave={hide}
            onFocus={(e) => show(e, m)}
            onBlur={hide}
            onClick={() => onOpen(row)}
          >
            {/* Invisible hit target bigger than the mark. */}
            <circle r={10} fill="transparent" />
            <MarkerShape state={m.state} />
          </g>
        </g>
      ))}
    </svg>
  );
});
