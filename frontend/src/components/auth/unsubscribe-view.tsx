"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { UnsubscribeInfo } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";

const T = {
  title: "Unsubscribe",
  question: (team: string) => `Stop all emails to ${team}?`,
  explanation: "After unsubscribing, this team will not receive any further emails from the organizer, including important updates.",
  confirm: "Unsubscribe",
  done: (team: string) => `${team} has been unsubscribed. You will not receive further emails.`,
  invalid: "This unsubscribe link is invalid or has expired.",
};

export function UnsubscribeView({ token }: { token: string }) {
  const path = `/public/unsubscribe/${encodeURIComponent(token)}`;
  const info = useApi(`unsub:${token}`, () => api.get<UnsubscribeInfo>(path));
  const [result, setResult] = useState<UnsubscribeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (info.loading && !info.data) return <LoadingState />;
  if (info.error) {
    return info.error.code === "NOT_FOUND" ? <Alert tone="error">{T.invalid}</Alert> : <ErrorAlert error={info.error} />;
  }
  if (!info.data) return null;

  const current = result ?? info.data;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post<UnsubscribeInfo>(path));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{T.title}</h1>
      {current.unsubscribed ? (
        <Alert tone="success">{T.done(current.teamName)}</Alert>
      ) : (
        <>
          <p className="font-medium text-slate-900">{T.question(current.teamName)}</p>
          <p className="text-sm text-slate-700">{T.explanation}</p>
          <ErrorAlert error={error} />
          <Button onClick={handleConfirm} loading={busy} className="w-full">
            {T.confirm}
          </Button>
        </>
      )}
    </div>
  );
}
