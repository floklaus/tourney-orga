"use client";

import { useId } from "react";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/field";

const T = {
  title: "Invitation link",
  description: "Share this link with the invitee; it is valid for 72 hours.",
  label: (email: string) => `Invitation link for ${email}`,
  note: "The server may not send invitation emails, so send the link yourself (e.g. by email or chat). Anyone with the link can create an account.",
  copy: "Copy link",
  done: "Done",
};

export interface InviteLink {
  email: string;
  url: string;
}

export function InviteLinkDialog({ link, onClose }: { link: InviteLink | null; onClose: () => void }) {
  return (
    <Dialog
      open={link !== null}
      onClose={onClose}
      title={T.title}
      description={T.description}
      footer={<Button onClick={onClose}>{T.done}</Button>}
    >
      {link && <InviteLinkBody link={link} />}
    </Dialog>
  );
}

function InviteLinkBody({ link }: { link: InviteLink }) {
  const inputId = useId();
  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
        {T.label(link.email)}
      </label>
      <input id={inputId} readOnly value={link.url} className={`${inputClass} font-mono`} onFocus={(e) => e.currentTarget.select()} />
      <CopyButton label={T.copy} variant="primary" size="md" onCopy={() => copyText(link.url)} />
      <p className="text-xs text-slate-600">{T.note}</p>
    </div>
  );
}
