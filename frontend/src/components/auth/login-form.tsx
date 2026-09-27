"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { safeNextPath } from "@/lib/format";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ErrorAlert } from "@/components/ui/alert";

const T = {
  title: "Sign in",
  email: "Email",
  password: "Password",
  submit: "Sign in",
  forgot: "Forgot your password?",
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post<User>("/auth/login", { email, password }, { noAuthRedirect: true });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      <h1 className="text-lg font-semibold text-slate-900">{T.title}</h1>
      <ErrorAlert error={error} />
      <TextField label={T.email} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField
        label={T.password}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" loading={busy} className="w-full">
        {T.submit}
      </Button>
      <p className="text-center text-sm">
        <Link href="/reset-password" className="font-medium text-brand-primary underline">
          {T.forgot}
        </Link>
      </p>
    </form>
  );
}
