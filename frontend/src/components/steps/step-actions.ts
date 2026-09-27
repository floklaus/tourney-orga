import type { EmailStep, EmailStepStatus } from "@/lib/types";

export type StepAction =
  | "edit"
  | "pause"
  | "resume"
  | "cancel"
  | "send-now"
  | "skip"
  | "delete"
  | "send-manually"
  | "view-message"
  | "resend"
  | "dismiss";

const EDITABLE: EmailStepStatus[] = ["SCHEDULED", "PAUSED"];
const DELETABLE: EmailStepStatus[] = ["PAUSED", "CANCELLED"];

export const ACTION_LABELS: Record<StepAction, string> = {
  edit: "Edit",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel email",
  "send-now": "Send now",
  skip: "Skip",
  delete: "Delete",
  "send-manually": "Send manually",
  "view-message": "View message",
  resend: "Resend",
  dismiss: "Dismiss failure",
};

/** Label overrides while the server is in MANUAL sending mode (nothing is sent automatically). */
const MANUAL_LABELS: Partial<Record<StepAction, string>> = {
  "send-now": "Prepare now",
  resend: "Retry manually",
};

export function actionLabel(action: StepAction, manual = false): string {
  return (manual && MANUAL_LABELS[action]) || ACTION_LABELS[action];
}

/** Variable keys this email needs but that have no value; sending is blocked while non-empty. */
export function missingVariablesOfStep(step: EmailStep): string[] {
  return step.missingVariables ?? [];
}

/** Actions the backend rejects (422) while the email's variables are missing. */
export const BLOCKED_BY_MISSING_VARIABLES: StepAction[] = ["send-now"];

export const blockedHintId = (step: EmailStep) => `step-${step.id}-blocked`;

export function isEditable(step: EmailStep): boolean {
  return EDITABLE.includes(step.status);
}

/** Actions allowed for an email step according to its status and its delivery. */
export function availableActions(step: EmailStep): StepAction[] {
  const actions: StepAction[] = [];
  const { status, isPastDue } = step;
  const delivery = step.delivery;
  if (delivery?.status === "READY") actions.push("send-manually");
  if (isEditable(step)) actions.push("edit");
  if (status === "SCHEDULED" || isPastDue) actions.push("send-now");
  if (isPastDue) actions.push("skip");
  if (status === "SCHEDULED" && !isPastDue) actions.push("pause");
  if (status === "PAUSED") actions.push("resume");
  if (status === "SCHEDULED" || status === "PAUSED") actions.push("cancel");
  if (delivery?.status === "FAILED") actions.push("resend", "dismiss");
  if (delivery?.status === "SENT" && delivery.sentManually) actions.push("view-message");
  if (DELETABLE.includes(status)) actions.push("delete");
  return actions;
}

const CONFIRM_MESSAGES: Partial<Record<StepAction, string>> = {
  "send-now": "Send this email to the team right now?",
  skip: "Skip this past-due email? It will be cancelled and never sent.",
  cancel: "Cancel this email? It will not be sent. This cannot be undone.",
  delete: "Delete this email permanently?",
  dismiss: "Dismiss the failed delivery? It is marked as skipped, is not retried and leaves the work queue.",
};

const MANUAL_CONFIRM_MESSAGES: Partial<Record<StepAction, string>> = {
  "send-now":
    "Prepare this email now? Nothing is sent automatically: it becomes “ready to send” so you can copy it and send it from your own mail program.",
};

export function confirmMessage(action: StepAction, manual = false): string | undefined {
  return (manual && MANUAL_CONFIRM_MESSAGES[action]) || CONFIRM_MESSAGES[action];
}
