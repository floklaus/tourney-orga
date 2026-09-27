import { ALL_STATUSES, STATUS_LABELS } from "@/lib/participation";
import type { ParticipationStatus, Tournament, TournamentTiming } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const TIMING: Record<TournamentTiming, { label: string; tone: BadgeTone }> = {
  UPCOMING: { label: "Upcoming", tone: "blue" },
  ONGOING: { label: "Ongoing", tone: "green" },
  PAST: { label: "Past", tone: "gray" },
};

export function TimingBadge({ timing }: { timing: TournamentTiming }) {
  const { label, tone } = TIMING[timing] ?? TIMING.UPCOMING;
  return <Badge tone={tone}>{label}</Badge>;
}

export function AgeGroupChips({ ageGroups }: { ageGroups: string[] }) {
  if (ageGroups.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ageGroups.map((g) => (
        <Badge key={g} tone="teal">
          {g}
        </Badge>
      ))}
    </span>
  );
}

type Bucket = "notStarted" | "inProgress" | "done" | "withdrawn";

const BUCKETS: { key: Bucket; label: string; className: string; statuses: ParticipationStatus[] }[] = [
  { key: "notStarted", label: "Signed up", className: "bg-slate-300", statuses: ["SIGNED_UP"] },
  {
    key: "inProgress",
    label: "In progress",
    className: "bg-brand-orange",
    statuses: ["PAID", "ADDED_TO_SPORTSENGINE", "ADDED_TO_STAFF_CALENDAR", "ROSTER_CONFIRMED", "WAIVER_REQUESTED", "WAIVER_CONFIRMED"],
  },
  { key: "done", label: "Participated", className: "bg-green-700", statuses: ["PARTICIPATED"] },
  { key: "withdrawn", label: "Withdrawn", className: "bg-red-200", statuses: ["WITHDRAWN"] },
];

/** Mini stacked bar of the participation statuses, with the full breakdown as text alternative. */
export function StatusSummary({ counts }: { counts: Tournament["statusCounts"] }) {
  const total = ALL_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  if (total === 0) return <span className="text-slate-500">—</span>;
  const breakdown = ALL_STATUSES.filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${STATUS_LABELS[s]} ${counts[s]}`)
    .join(", ");
  const buckets = BUCKETS.map((b) => ({ ...b, count: b.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0) })).filter((b) => b.count > 0);
  return (
    <span className="block w-36" title={breakdown}>
      <span className="sr-only">{breakdown}</span>
      <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {buckets.map((b) => (
          <span key={b.key} className={b.className} style={{ width: `${(b.count / total) * 100}%` }} />
        ))}
      </span>
      <span aria-hidden="true" className="mt-1 block text-xs text-slate-600">
        {buckets.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(" · ")}
      </span>
    </span>
  );
}
