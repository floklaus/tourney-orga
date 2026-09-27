"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordFields, passwordError } from "./password-fields";

const T = {
  title: "Choose a new password",
  submit: "Set password",
  done: "Your password has been changed. You can now sign in.",
  signIn: "Go to sign in",
};

export function ResetConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (passwordError(password, confirm)) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password-reset/confirm", { token, password });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{T.done}</Alert>
        <Link href="/login" className="block text-center text-sm font-medium text-brand-primary underline">
          {T.signIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{T.title}</h1>
      <ErrorAlert error={error} />
      <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} showErrors={submitted} />
      <Button type="submit" loading={busy} className="w-full">
        {T.submit}
      </Button>
    </form>
  );
}
