"use client";

import type { ReactNode } from "react";
import { copyRich, copyText } from "@/lib/clipboard";
import type { ManualMessage } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";

const T = {
  howTo: "Create a new email in your mail program, copy each part below into it, send it, then mark it as sent here.",
  to: "To",
  cc: "CC",
  subject: "Subject",
  body: "Body",
  copy: "Copy",
  copyBody: "Copy body",
  bodyHint: "Copies the formatted text, so pasting into Gmail or Outlook keeps links and formatting.",
  openMail: "Open in mail app",
  openMailHint: "Opens a new email with recipients, subject and plain-text body filled in.",
  truncatedTitle: "The body was shortened for the mail app link",
  truncated: "The message is too long for a mailto link. After opening your mail app, replace the body with the copied body (“Copy body”).",
  preview: "Email body preview",
  plain: "Plain-text version",
};

function isMailto(url: string): boolean {
  return /^mailto:/i.test(url);
}

function Row({ label, value, copyLabel, onCopy }: { label: string; value: ReactNode; copyLabel: string; onCopy: () => Promise<"rich" | "plain"> }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <dt className="w-20 shrink-0 text-sm font-medium text-slate-800">{label}</dt>
      <dd className="min-w-0 flex-1 break-all text-sm text-slate-900">{value}</dd>
      <dd className="shrink-0">
        <CopyButton label={T.copy} aria-label={copyLabel} onCopy={onCopy} />
      </dd>
    </div>
  );
}

export function ManualMessagePanel({ message }: { message: ManualMessage }) {
  const ccList = message.cc.join(", ");
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">{T.howTo}</p>

      <dl className="rounded-md border border-slate-200 bg-white px-3">
        <Row label={T.to} value={message.to} copyLabel="Copy To address" onCopy={() => copyText(message.to)} />
        {message.cc.length > 0 && <Row label={T.cc} value={ccList} copyLabel="Copy CC addresses" onCopy={() => copyText(ccList)} />}
        <Row label={T.subject} value={message.subject} copyLabel="Copy subject" onCopy={() => copyText(message.subject)} />
      </dl>

      <section aria-labelledby="manual-body-title" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="manual-body-title" className="text-sm font-semibold text-slate-900">
            {T.body}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {isMailto(message.mailtoUrl) && (
              <a
                href={message.mailtoUrl}
                title={T.openMailHint}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {T.openMail}
              </a>
            )}
            <CopyButton label={T.copyBody} variant="primary" onCopy={() => copyRich(message.html, message.text)} />
          </div>
        </div>
        <p className="text-xs text-slate-600">{T.bodyHint}</p>
        {message.mailtoTruncated && (
          <Alert tone="warning" title={T.truncatedTitle}>
            {T.truncated}
          </Alert>
        )}
        <iframe title={T.preview} sandbox="" srcDoc={message.html} className="h-80 w-full rounded-md border border-slate-200 bg-white" />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">{T.plain}</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background-card p-3 text-xs text-slate-800">{message.text}</pre>
        </details>
      </section>
    </div>
  );
}
