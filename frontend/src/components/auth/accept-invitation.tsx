"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { useApi } from "@/lib/use-api";
import type { InvitationInfo, User } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/states";
import { PasswordFields, passwordError } from "./password-fields";

const T = {
  title: "Accept invitation",
  invalid: "This invitation link is invalid, expired or has already been used.",
  invalidHint: "Ask the organizer who invited you to resend the invitation.",
  submit: "Create account",
};

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const invitation = useApi(`invitation:${token}`, () =>
    api.get<InvitationInfo>(`/invitations/${encodeURIComponent(token)}`),
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (invitation.loading && !invitation.data) return <LoadingState />;
  if (invitation.error) {
    const invalid = invitation.error.code === "NOT_FOUND" || invitation.error.code === "CONFLICT";
    return invalid ? (
      <Alert tone="error" title={T.invalid}>
        {T.invalidHint}
      </Alert>
    ) : (
      <ErrorAlert error={invitation.error} />
    );
  }
  if (!invitation.data) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (passwordError(password, confirm) || !firstName.trim() || !lastName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<User>("/invitations/accept", { token, firstName: firstName.trim(), lastName: lastName.trim(), password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{T.title}</h1>
      <p className="text-sm text-slate-700">
        You were invited as <strong>{invitation.data.email}</strong>. The link expires on{" "}
        {formatDateTime(invitation.data.expiresAt)}.
      </p>
      <ErrorAlert error={error} />
      <TextField label="First name" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
        error={submitted && !firstName.trim() ? "Required." : undefined} />
      <TextField label="Last name" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)}
        error={submitted && !lastName.trim() ? "Required." : undefined} />
      <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} showErrors={submitted} />
      <Button type="submit" loading={busy} className="w-full">
        {T.submit}
      </Button>
    </form>
  );
}
