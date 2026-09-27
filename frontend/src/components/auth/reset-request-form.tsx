"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

const T = {
  title: "Reset your password",
  intro: "Enter your email address and we will send you a link to set a new password.",
  submit: "Send reset link",
  done: "If an account exists for that address, a reset link is on its way. The link is valid for 1 hour.",
  back: "Back to sign in",
};

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password-reset/request", { email });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{T.title}</h1>
      {done ? (
        <Alert tone="success">{T.done}</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-700">{T.intro}</p>
          <ErrorAlert error={error} />
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy} className="w-full">
            {T.submit}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-brand-primary underline">
          {T.back}
        </Link>
      </p>
    </div>
  );
}
