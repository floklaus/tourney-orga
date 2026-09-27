const ITEMS = [
  {
    title: "DKIM signing enabled",
    text: "In the Google Admin console (Apps → Google Workspace → Gmail → Authenticate email), generate a DKIM key, publish the TXT record and click “Start authentication”. DKIM is off by default.",
  },
  {
    title: "SPF record includes Google",
    text: "Your domain's SPF TXT record must contain include:_spf.google.com, e.g. v=spf1 include:_spf.google.com ~all.",
  },
  {
    title: "DMARC record exists",
    text: "Publish a TXT record at _dmarc.<your-domain>, e.g. v=DMARC1; p=none; rua=mailto:dmarc@<your-domain>, and tighten the policy once reports look clean.",
  },
  {
    title: "Sending limits respected",
    text: "Google Workspace allows about 2,000 messages and 10,000 recipients per rolling 24 h. The daily cap here should leave room for your normal email.",
  },
];

export function DeliverabilityChecklist({ note }: { note?: string }) {
  return (
    <section aria-labelledby="checklist-title" className="rounded-lg border border-neutral-300 bg-background-card p-4 sm:p-5">
      <h2 id="checklist-title" className="text-base font-semibold text-neutral-900">
        Google Workspace deliverability checklist
      </h2>
      <p className="mt-1 text-sm text-neutral-900">
        One-time setup by your Workspace admin. Emails are always sent from the authenticated mailbox, so no other DNS changes are needed.
      </p>
      {note && <p className="mt-2 text-sm font-medium text-neutral-900">{note}</p>}
      <ol className="mt-3 space-y-3">
        {ITEMS.map((item, i) => (
          <li key={item.title} className="flex gap-3 text-sm">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-neutral-800 ring-1 ring-neutral-300">
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-neutral-900">{item.title}</p>
              <p className="text-neutral-800">{item.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href="https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm font-medium text-neutral-900 underline"
      >
        Google: Gmail sending limits (opens in a new tab)
      </a>
    </section>
  );
}
