"use client";

import Link from "next/link";
import { useAttention, useTimeZone } from "@/lib/queries";
import { useNow } from "@/lib/use-now";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/page-header";
import { EmptyState, QueryView } from "@/components/ui/states";
import { AttentionItemCard } from "@/components/queue/attention-item";
import type { AttentionActions } from "@/components/queue/use-attention-actions";

const TOP_ITEMS = 5;

const T = {
  title: "Needs attention",
  open: (n: number) => `Open work queue (${n})`,
  urgent: (n: number) => `${n} urgent`,
  empty: "Nothing needs your attention 🎉",
};

/** Top work-queue items on the dashboard; the actions (and their dialogs) live in the page. */
export function NeedsAttentionCard({ actions }: { actions: AttentionActions }) {
  const attention = useAttention();
  const nowMs = useNow();
  const timeZone = useTimeZone();
  const counts = attention.data?.counts;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {T.title}
          {counts && counts.high > 0 && <Badge tone="red">{T.urgent(counts.high)}</Badge>}
        </span>
      }
      actions={
        counts && (
          <Link href="/queue" className="text-sm font-medium text-brand-primary underline">
            {T.open(counts.total)}
          </Link>
        )
      }
    >
      <QueryView
        {...attention}
        onRetry={attention.reload}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title={T.empty} />}
      >
        {(data) => (
          <ul className="space-y-2">
            {data.items.slice(0, TOP_ITEMS).map((item) => (
              <li key={item.id}>
                <AttentionItemCard item={item} timeZone={timeZone} nowMs={nowMs} actions={actions} compact />
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Card>
  );
}
