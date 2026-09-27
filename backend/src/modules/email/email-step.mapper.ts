import { EmailDelivery } from '../delivery/email-delivery.entity';
import { toUserRef } from '../user/user.mapper';
import { EmailStep, UNSENT_STEP_STATUSES } from './email-step.entity';
import { missingVariablesOf } from './variables';

export const toDeliverySummary = (d: EmailDelivery | undefined) =>
  d
    ? {
        id: d.id,
        status: d.status,
        sentManually: d.sentManually,
        sentAt: d.sentAt,
        lastError: d.lastError,
      }
    : null;

/** `variables` = effective variables of the step's participation. */
export function toEmailStepResponse(
  step: EmailStep,
  variables: Record<string, string>,
  delivery: EmailDelivery | undefined,
) {
  return {
    id: step.id,
    participationId: step.participationId,
    planItemId: step.planItemId,
    name: step.name,
    templateId: step.template?.id ?? null,
    templateName: step.template?.name ?? null,
    subjectOverride: step.subjectOverride,
    timingType: step.timingType,
    sendAt: step.sendAt,
    offsetDays: step.offsetDays,
    timeOfDay: step.timeOfDay,
    anchor: step.anchor,
    resolvedSendAt: step.resolvedSendAt,
    status: step.status,
    isPastDue: step.requiresDecision,
    missingVariables: UNSENT_STEP_STATUSES.includes(step.status)
      ? missingVariablesOf(step, variables)
      : [],
    delivery: toDeliverySummary(delivery),
    sentAt: step.sentAt,
    version: step.version,
    createdBy: toUserRef(step.createdBy),
    updatedBy: toUserRef(step.updatedBy),
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

export type EmailStepResponse = ReturnType<typeof toEmailStepResponse>;
