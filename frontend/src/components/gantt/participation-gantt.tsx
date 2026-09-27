"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatDay, formatDayRange, fromDayNumber } from "@/lib/days";
import { cn } from "@/lib/format";
import type { Participation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { buildGanttModel, type GanttModel, type GanttZoom, type RowModel } from "./gantt-model";
import { GanttLegend } from "./gantt-legend";
import { GanttRowChart, ROW_HEIGHT, type TipHandler } from "./gantt-marks";

const LABEL_WIDTH = 240;
const AXIS_HEIGHT = 44;
const GROUP_HEIGHT = 32;

const T = {
  region: "Participation timeline",
  zoom: "Zoom",
  week: "Weeks",
  month: "Months",
  today: "Jump to today",
  todayLabel: "Today",
  column: "Team",
  teams: (n: number) => `${n} ${n === 1 ? "team" : "teams"}`,
  summary: (rows: number, groups: number, from: string, to: string) =>
    `Timeline chart of ${rows} participations in ${groups} tournaments, ${from} to ${to}. ` +
    "Each row shows the eight milestones at their due dates, the tournament dates as a bar and the next planned email as an envelope. " +
    "Use the arrow keys to move between the milestones of a row and Enter to open the details. The table view lists the same data as text.",
};

interface Props {
  participations: Participation[];
  /** "YYYY-MM-DD" in the settings timezone. */
  today: string;
  timeZone: string;
  onOpen: (participation: Participation) => void;
}

interface Tip {
  left: number;
  top: number;
  text: string;
}

/** Gantt chart of participations (plain SVG), grouped by tournament. */
export function ParticipationGantt({ participations, today, timeZone, onOpen }: Props) {
  const [zoom, setZoom] = useState<GanttZoom>("month");
  const model = useMemo(() => buildGanttModel(participations, today, timeZone, zoom), [participations, today, timeZone, zoom]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const summaryId = useId();
  const [tip, setTip] = useState<Tip | null>(null);

  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  });
  const openRow = useCallback((row: RowModel) => openRef.current(row.participation), []);
  const onTip = useCallback<TipHandler>((target, text) => {
    if (!target) return setTip(null);
    const rect = target.getBoundingClientRect();
    setTip({ left: rect.left + rect.width / 2, top: rect.bottom + 6, text });
  }, []);

  const todayX = model.todayX;
  const jumpToToday = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, LABEL_WIDTH + todayX - (el.clientWidth + LABEL_WIDTH) / 2);
  }, [todayX]);
  useEffect(() => jumpToToday(), [jumpToToday]);

  const bodyHeight = model.groups.length * GROUP_HEIGHT + model.rowCount * ROW_HEIGHT;
  const width = model.scale.width;
  const rangeFrom = formatDay(fromDayNumber(model.scale.startDay));
  const rangeTo = formatDay(fromDayNumber(model.scale.startDay + model.scale.days - 1));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GanttLegend />
        <div className="flex flex-wrap gap-2">
          <div role="group" aria-label={T.zoom} className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {(["week", "month"] as GanttZoom[]).map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => setZoom(z)}
                className={cn("px-3 py-1.5 text-sm font-medium", zoom === z ? "bg-brand-primary text-white" : "bg-white text-slate-800 hover:bg-slate-50")}
              >
                {z === "week" ? T.week : T.month}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={jumpToToday}>
            {T.today}
          </Button>
        </div>
      </div>
      <p id={summaryId} className="sr-only">
        {T.summary(model.rowCount, model.groups.length, rangeFrom, rangeTo)}
      </p>
      <div
        ref={scrollRef}
        role="region"
        aria-label={T.region}
        aria-describedby={summaryId}
        tabIndex={0}
        onScroll={() => {
          if (tip) setTip(null);
        }}
        className="relative max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white"
      >
        <div className="relative" style={{ width: LABEL_WIDTH + width }}>
          <Axis model={model} />
          <Grid model={model} height={bodyHeight} />
          {model.groups.map((group) => (
            <div key={group.id} className="relative">
              <div className="flex border-b border-slate-200 bg-slate-50" style={{ height: GROUP_HEIGHT }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-2 text-sm" style={{ width: LABEL_WIDTH }}>
                  <Link href={`/tournaments/${group.id}`} className="truncate font-semibold text-brand-primary underline" title={group.name}>
                    {group.name}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-600">{formatDayRange(group.startDate, group.endDate)}</span>
                </div>
                <svg width={width} height={GROUP_HEIGHT} aria-hidden="true" className="block">
                  <rect x={group.barStart} y={0} width={Math.max(2, group.barEnd - group.barStart)} height={GROUP_HEIGHT} fill="#fdf1e6" />
                  <text x={group.barEnd + 6} y={GROUP_HEIGHT / 2 + 4} className="fill-slate-600 text-[11px]">
                    {T.teams(group.rows.length)}
                  </text>
                </svg>
              </div>
              {group.rows.map((row) => (
                <div key={row.participation.id} className="relative flex border-b border-slate-100" style={{ height: ROW_HEIGHT }}>
                  <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-200 bg-white px-2" style={{ width: LABEL_WIDTH }}>
                    <button
                      type="button"
                      onClick={() => openRow(row)}
                      aria-label={row.summary}
                      title={row.summary}
                      className={cn("truncate text-left text-sm text-slate-900 hover:underline", row.withdrawn && "text-slate-500 line-through")}
                    >
                      {row.participation.team.name}
                      {row.participation.ageGroup && <span className="ml-1 text-xs text-slate-600">{row.participation.ageGroup}</span>}
                    </button>
                  </div>
                  <GanttRowChart row={row} width={width} onOpen={openRow} onTip={onTip} />
                </div>
              ))}
            </div>
          ))}
          <svg aria-hidden="true" className="pointer-events-none absolute z-[5]" style={{ left: LABEL_WIDTH, top: AXIS_HEIGHT }} width={width} height={bodyHeight}>
            <line x1={todayX} x2={todayX} y1={0} y2={bodyHeight} stroke="#a8570f" strokeWidth={2} />
          </svg>
        </div>
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-xs -translate-x-1/2 whitespace-pre-line rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: tip.left, top: tip.top }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Axis({ model }: { model: GanttModel }) {
  const { scale, months, weeks } = model;
  const showWeeks = scale.pxPerDay * 7 >= 40;
  return (
    <div className="sticky top-0 z-20 flex border-b border-slate-300 bg-white" style={{ height: AXIS_HEIGHT }}>
      <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-200 bg-background-card px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700" style={{ width: LABEL_WIDTH }}>
        {T.column}
      </div>
      <svg aria-hidden="true" width={scale.width} height={AXIS_HEIGHT} className="block">
        {months.map((tick) => (
          <g key={tick.day}>
            <line x1={tick.x} x2={tick.x} y1={0} y2={AXIS_HEIGHT} stroke="#cbd5e1" />
            <text x={tick.x + 4} y={14} className="fill-slate-800 text-[11px] font-semibold">
              {tick.label}
            </text>
          </g>
        ))}
        {showWeeks &&
          weeks.map((tick) => (
            <g key={tick.day}>
              <line x1={tick.x} x2={tick.x} y1={AXIS_HEIGHT - 8} y2={AXIS_HEIGHT} stroke="#94a3b8" />
              <text x={tick.x + 3} y={AXIS_HEIGHT - 10} className="fill-slate-600 text-[10px]">
                {tick.label}
              </text>
            </g>
          ))}
        <g transform={`translate(${model.todayX} 0)`}>
          <rect x={-22} y={AXIS_HEIGHT - 16} width={44} height={14} rx={3} fill="#a8570f" />
          <text x={0} y={AXIS_HEIGHT - 5.5} textAnchor="middle" className="fill-white text-[10px] font-semibold">
            {T.todayLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Recessive month (and, when zoomed in, week) lines behind all rows. */
function Grid({ model, height }: { model: GanttModel; height: number }) {
  const showWeeks = model.scale.pxPerDay * 7 >= 40;
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute" style={{ left: LABEL_WIDTH, top: AXIS_HEIGHT }} width={model.scale.width} height={height}>
      {showWeeks && model.weeks.map((t) => <line key={`w${t.day}`} x1={t.x} x2={t.x} y1={0} y2={height} stroke="#f1f5f9" />)}
      {model.months.map((t) => (
        <line key={`m${t.day}`} x1={t.x} x2={t.x} y1={0} y2={height} stroke="#e2e8f0" />
      ))}
    </svg>
  );
}
