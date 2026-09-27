"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { fullName, isValidEmail } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Invitation } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextField } from "@/components/ui/field";
import { EmptyState, QueryView } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { InviteLinkDialog, type InviteLink } from "./invite-link-dialog";

export function InvitationsPanel() {
  const toast = useToast();
  const invitations = useApi("invitations", () => api.get<Invitation[]>("/users/invitations"));
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);

  /** The server may not send emails; if it returns a link, show it so it can be shared by hand. */
  function afterInvite(result: Invitation, email: string, sentMessage: string) {
    if (result.inviteUrl) {
      toast.show(`Invitation created for ${email}.`);
      setInviteLink({ email, url: result.inviteUrl });
    } else {
      toast.show(sentMessage);
    }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(undefined);
    setBusy("invite");
    setError(null);
    try {
      const result = await api.post<Invitation>("/users/invitations", { email: email.trim() });
      afterInvite(result, email.trim(), `Invitation sent to ${email.trim()}.`);
      setEmail("");
      invitations.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function resend(invitation: Invitation) {
    setBusy(invitation.id);
    try {
      const result = await api.post<Invitation>(`/users/invitations/${invitation.id}/resend`);
      afterInvite(result, invitation.email, `Invitation resent to ${invitation.email}.`);
      invitations.reload();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={invite} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField label="Invite a co-organizer" type="email" placeholder="name@example.org" value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} className="flex-1" hint="The link is valid for 72 hours." />
        <Button type="submit" loading={busy === "invite"} className="sm:mb-5">
          Send invitation
        </Button>
      </form>
      <ErrorAlert error={error} />
      <QueryView
        {...invitations}
        onRetry={invitations.reload}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="No pending invitations" />}
      >
        {(data) => (
          <Table caption="Pending invitations">
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Invited by</Th>
                <Th>Expires</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((inv) => (
                <tr key={inv.id}>
                  <Td className="break-all font-medium text-slate-900">{inv.email}</Td>
                  <Td>{fullName(inv.invitedBy)}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(inv.expiresAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => resend(inv)} loading={busy === inv.id}>
                        Resend
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setRevoking(inv)}>
                        Revoke
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryView>
      <ConfirmDialog
        open={revoking !== null}
        title="Revoke invitation"
        danger
        confirmLabel="Revoke"
        message={<p>Revoke the invitation for <strong>{revoking?.email}</strong>? The link stops working.</p>}
        onConfirm={async () => {
          if (!revoking) return;
          await api.delete(`/users/invitations/${revoking.id}`);
          toast.show("Invitation revoked.");
          invitations.reload();
        }}
        onClose={() => setRevoking(null)}
      />
      <InviteLinkDialog link={inviteLink} onClose={() => setInviteLink(null)} />
    </div>
  );
}
