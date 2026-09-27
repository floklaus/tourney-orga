"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { useAttention, useTimeZone } from "@/lib/queries";
import { useNow } from "@/lib/use-now";
import type { AttentionItem, AttentionSeverity, AttentionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, QueryView } from "@/components/ui/states";
import { AttentionItemCard } from "./attention-item";
import { SEVERITIES, SEVERITY_LABELS, SEVERITY_TONES, TYPE_LABELS, TYPE_ORDER } from "./attention-meta";
import { useAttentionActions, type AttentionActions } from "./use-attention-actions";

const T = {
  title: "Work queue",
  description: "Everything that needs a decision or manual work, most urgent first. Refreshed every minute.",
  refresh: "Refresh",
  empty: "Nothing needs your attention 🎉",
  emptyHint: "New tasks appear here automatically, e.g. missing variables, past-due emails or emails to send manually.",
  filter: "Filter by type",
  all: "All",
  section: (label: string) => `${label} priority`,
  noMatch: "No items of this type.",
};

type Filter = AttentionType | "ALL";

function FilterChips({ items, value, onChange }: { items: AttentionItem[]; value: Filter; onChange: (f: Filter) => void }) {
  const counts = new Map<AttentionType, number>();
  items.forEach((i) => counts.set(i.type, (counts.get(i.type) ?? 0) + 1));
  const types = TYPE_ORDER.filter((t) => counts.has(t));
  const chip = (filter: Filter, label: string, count: number) => (
    <button
      key={filter}
      type="button"
      aria-pressed={value === filter}
      onClick={() => onChange(filter)}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium",
        value === filter ? "border-brand-primary bg-brand-primary text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
      )}
    >
      {label} <span className={value === filter ? "text-orange-100" : "text-slate-500"}>{count}</span>
    </button>
  );
  return (
    <div role="group" aria-label={T.filter} className="mb-6 flex flex-wrap gap-2">
      {chip("ALL", T.all, items.length)}
      {types.map((t) => chip(t, TYPE_LABELS[t], counts.get(t) ?? 0))}
    </div>
  );
}

interface ListProps {
  items: AttentionItem[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  actions: AttentionActions;
}

function QueueList({ items, filter, onFilter, actions }: ListProps) {
  const nowMs = useNow();
  const timeZone = useTimeZone();
  // A filter whose type no longer occurs (e.g. after an action) falls back to "All".
  const active: Filter = filter !== "ALL" && items.some((i) => i.type === filter) ? filter : "ALL";
  const visible = active === "ALL" ? items : items.filter((i) => i.type === active);
  const bySeverity = (s: AttentionSeverity) => visible.filter((i) => i.severity === s);

  return (
    <>
      <FilterChips items={items} value={active} onChange={onFilter} />
      <div className="space-y-8">
        {SEVERITIES.map((severity) => {
          const group = bySeverity(severity);
          if (group.length === 0) return null;
          const headingId = `queue-${severity.toLowerCase()}`;
          return (
            <section key={severity} aria-labelledby={headingId}>
              <h2 id={headingId} className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                {T.section(SEVERITY_LABELS[severity])}
                <Badge tone={SEVERITY_TONES[severity]}>{group.length}</Badge>
              </h2>
              <ul className="space-y-3">
                {group.map((item) => (
                  <li key={item.id}>
                    <AttentionItemCard item={item} timeZone={timeZone} nowMs={nowMs} actions={actions} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function QueuePage() {
  const attention = useAttention();
  const [filter, setFilter] = useState<Filter>("ALL");
  // Kept outside the list so an open dialog survives the queue becoming empty.
  const { actions, dialogs } = useAttentionActions();
  return (
    <>
      <PageHeader
        title={T.title}
        description={T.description}
        actions={
          <Button variant="secondary" onClick={attention.reload} loading={attention.loading && attention.data !== undefined}>
            {T.refresh}
          </Button>
        }
      />
      <QueryView
        {...attention}
        onRetry={attention.reload}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title={T.empty} description={T.emptyHint} />}
      >
        {(data) => <QueueList items={data.items} filter={filter} onFilter={setFilter} actions={actions} />}
      </QueryView>
      {dialogs}
    </>
  );
}
