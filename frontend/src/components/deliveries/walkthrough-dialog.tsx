"use client";

import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, QueryView } from "@/components/ui/states";
import { fetchReadyDeliveries, type DeliveryScope } from "@/components/steps/deliveries-api";
import { ManualSession, type SessionDelivery } from "@/components/steps/manual-session";

const T = {
  title: "Send emails manually",
  close: "← Close",
  noneTitle: "No emails are ready to send",
  noneHint: "Emails become “ready to send” when they are due in manual sending mode (or after “Prepare now”).",
  closeButton: "Close",
};

export interface WalkthroughTarget {
  /** GET /deliveries filters; status READY is added automatically. */
  scope: DeliveryScope;
  title?: string;
  /** Delivery to open first (READY, FAILED or a manually sent one); defaults to the first READY one. */
  start?: SessionDelivery;
}

interface Props {
  target: WalkthroughTarget | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Manual walk-through over the READY deliveries of a list query (across teams, steps and tournaments). */
export function WalkthroughDialog({ target, onClose, onChanged }: Props) {
  return (
    <Dialog open={target !== null} onClose={onClose} title={target?.title ?? T.title} size="xl">
      {target && <WalkthroughBody target={target} onClose={onClose} onChanged={onChanged} />}
    </Dialog>
  );
}

function WalkthroughBody({ target, onClose, onChanged }: { target: WalkthroughTarget; onClose: () => void; onChanged: () => void }) {
  const { scope, start } = target;
  const ready = useApi(`walkthrough:${JSON.stringify(scope)}`, () => fetchReadyDeliveries(scope));
  return (
    <QueryView data={ready.data} error={ready.error} loading={ready.loading} onRetry={ready.reload}>
      {(list) => {
        const first = start ?? list[0];
        if (!first) {
          return (
            <EmptyState title={T.noneTitle} description={T.noneHint} action={<Button onClick={onClose}>{T.closeButton}</Button>} />
          );
        }
        return (
          <ManualSession
            start={first}
            ready={list}
            loadReady={() => fetchReadyDeliveries(scope)}
            onExit={onClose}
            onLeave={onClose}
            onChanged={onChanged}
            backLabel={T.close}
          />
        );
      }}
    </QueryView>
  );
}
