"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { Quota } from "@/lib/types";

const WARN_RATIO = 0.8;

const withFullStop = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function QuotaWidget({ quota }: { quota: Quota }) {
  const ratio = quota.cap > 0 ? Math.min(1, quota.used / quota.cap) : 0;
  const percent = Math.round(ratio * 100);
  const barColor = ratio >= 1 ? "bg-red-600" : ratio >= WARN_RATIO ? "bg-amber-500" : "bg-brand-secondary";
  return (
    <div>
      <p className="text-3xl font-semibold text-slate-900">
        {quota.remaining.toLocaleString("en-GB")}
        <span className="ml-1 text-sm font-normal text-slate-600">recipients left</span>
      </p>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="meter"
        aria-label="Recipients used in the last 24 hours"
        aria-valuemin={0}
        aria-valuemax={quota.cap}
        aria-valuenow={quota.used}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {quota.used.toLocaleString("en-GB")} of {quota.cap.toLocaleString("en-GB")} used in the rolling 24 h window ({percent}%).
      </p>
    </div>
  );
}

export function PauseBanner({ quota, onResumed }: { quota: Quota; onResumed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!quota.pausedUntil) return null;

  async function resume() {
    setBusy(true);
    setFailed(false);
    try {
      await api.post<Quota>("/deliveries/resume");
      onResumed();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-red-900">
      <p className="font-semibold">Sending is paused until {formatDateTime(quota.pausedUntil)}</p>
      <p className="mt-1 text-sm">
        {withFullStop(quota.pauseReason ?? "The mail server reported a sending limit")} Queued emails will be sent automatically once sending resumes; nothing is retried in the meantime.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <Button size="sm" variant="secondary" onClick={resume} loading={busy}>
          Resume sending now
        </Button>
        <span>Only resume after fixing the cause (e.g. mailbox credentials); Gmail blocks sending for up to 24 h after its limit is hit.</span>
      </p>
      {failed && <p className="mt-2 text-sm font-medium">Could not resume sending. Please try again.</p>}
    </div>
  );
}
