import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import type { DeliveryStatus, EmailStepStatus } from "@/lib/types";

export type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "teal" | "purple";

const TONES: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-800 ring-slate-300",
  blue: "bg-brand-orange-soft text-brand-ink ring-brand-orange-muted",
  green: "bg-green-50 text-green-900 ring-green-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-300",
  red: "bg-red-50 text-red-900 ring-red-200",
  teal: "bg-neutral-100 text-neutral-900 ring-neutral-300",
  purple: "bg-purple-50 text-purple-900 ring-purple-200",
};

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STEP_TONES: Record<EmailStepStatus, BadgeTone> = {
  SCHEDULED: "blue",
  PAUSED: "amber",
  SENDING: "purple",
  SENT: "green",
  FAILED: "red",
  CANCELLED: "gray",
};

const DELIVERY_TONES: Record<DeliveryStatus, BadgeTone> = {
  QUEUED: "blue",
  READY: "purple",
  SENT: "green",
  FAILED: "red",
  SKIPPED: "amber",
};

const label = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

export function StepStatusBadge({ status }: { status: EmailStepStatus }) {
  return <Badge tone={STEP_TONES[status] ?? "gray"}>{label(status)}</Badge>;
}

const DELIVERY_LABELS: Partial<Record<DeliveryStatus, string>> = {
  READY: "Ready to send",
};

export function deliveryStatusLabel(status: DeliveryStatus): string {
  return DELIVERY_LABELS[status] ?? label(status);
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge tone={DELIVERY_TONES[status]}>{deliveryStatusLabel(status)}</Badge>;
}
