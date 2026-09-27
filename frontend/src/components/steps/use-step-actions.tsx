"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isConflict, missingVariablesOf, sendErrorMessage } from "@/lib/errors";
import type { Delivery, EmailStep } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { bulkDeliveries } from "./deliveries-api";
import { actionLabel, confirmMessage, type StepAction } from "./step-actions";

type SimpleAction = "pause" | "resume" | "cancel" | "send-now" | "skip";
const SIMPLE: SimpleAction[] = ["pause", "resume", "cancel", "send-now", "skip"];

const T = {
  done: "Done.",
  conflict: "The email was reloaded with its latest state.",
  confirm: "Confirm",
};

const DONE_MESSAGES: Partial<Record<StepAction, string>> = {
  pause: "Email paused.",
  resume: "Email resumed.",
  cancel: "Email cancelled.",
  "send-now": "Email is being sent now.",
  skip: "Email skipped.",
  delete: "Email deleted.",
  resend: "Resend queued.",
  dismiss: "Failed delivery dismissed.",
};

const MANUAL_DONE_MESSAGES: Partial<Record<StepAction, string>> = {
  "send-now": "Email prepared. Use “Send manually” to copy and send it.",
  resend: "The email is ready to send manually again.",
};

interface Options {
  onEdit: (step: EmailStep) => void;
  /** Opens the manual walk-through at this step's delivery. */
  onOpenMessage: (step: EmailStep) => void;
  onChanged: () => void;
  /** True while the server is in MANUAL sending mode. */
  manual?: boolean;
}

/** Runs email step actions (with confirmation where needed) and renders the confirmation dialog. */
export function useStepActions({ onEdit, onOpenMessage, onChanged, manual = false }: Options) {
  const toast = useToast();
  const [pending, setPending] = useState<{ action: StepAction; step: EmailStep } | null>(null);

  async function execute(action: StepAction, step: EmailStep) {
    const deliveryId = step.delivery?.id;
    if (SIMPLE.includes(action as SimpleAction)) await api.post<EmailStep>(`/steps/${step.id}/${action}`);
    else if (action === "delete") await api.delete(`/steps/${step.id}`);
    else if (action === "resend" && deliveryId) await api.post<Delivery>(`/deliveries/${deliveryId}/resend`);
    else if (action === "dismiss" && deliveryId) {
      const [result] = (await bulkDeliveries([deliveryId], "dismiss")).results;
      if (result && !result.ok) throw new Error(result.error ?? T.done);
    }
    toast.show((manual && MANUAL_DONE_MESSAGES[action]) || DONE_MESSAGES[action] || T.done);
    onChanged();
  }

  async function executeWithFeedback(action: StepAction, step: EmailStep) {
    try {
      await execute(action, step);
    } catch (err) {
      toast.show(isConflict(err) ? `${sendErrorMessage(err)} ${T.conflict}` : sendErrorMessage(err), "error");
      if (isConflict(err) || missingVariablesOf(err)) onChanged();
    }
  }

  function run(action: StepAction, step: EmailStep) {
    if (action === "edit") onEdit(step);
    else if (action === "send-manually" || action === "view-message") onOpenMessage(step);
    else if (confirmMessage(action, manual)) setPending({ action, step });
    else void executeWithFeedback(action, step);
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending ? `${actionLabel(pending.action, manual)}: ${pending.step.name}` : ""}
      message={pending ? confirmMessage(pending.action, manual) : ""}
      confirmLabel={pending ? actionLabel(pending.action, manual) : T.confirm}
      danger={pending?.action === "delete" || pending?.action === "cancel" || pending?.action === "dismiss"}
      onConfirm={async () => {
        if (!pending) return;
        try {
          await execute(pending.action, pending.step);
        } catch (err) {
          if (isConflict(err) || missingVariablesOf(err)) onChanged();
          // Spell out a missing-variables 422 instead of the raw server message.
          throw missingVariablesOf(err) ? new Error(sendErrorMessage(err)) : err;
        }
      }}
      onClose={() => setPending(null)}
    />
  );

  return { run, dialog };
}
