import { DataSource, In } from 'typeorm';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../delivery/email-delivery.entity';
import {
  EmailStep,
  StepStatus,
  UNSENT_STEP_STATUSES,
} from '../email/email-step.entity';
import {
  effectiveVariables,
  missingVariablesOf,
  participationVariables,
} from '../email/variables';
import { EmailTemplate } from '../template/email-template.entity';
import { findTournamentVars } from '../template/domain/placeholders';
import { ParticipationStatus } from './domain/participation-process';
import { Participation } from './participation.entity';
import { Tournament } from './tournament.entity';

export interface EmailData {
  steps: EmailStep[];
  deliveryStatus: Map<string, DeliveryStatus>;
}

/** Loads the email steps (with templates) and their delivery status for many participations at once. */
export async function loadEmailData(
  dataSource: DataSource,
  participationIds: string[],
): Promise<Map<string, EmailData>> {
  const result = new Map<string, EmailData>();
  if (participationIds.length === 0) return result;
  const steps = await dataSource.getRepository(EmailStep).find({
    where: { participation: { id: In(participationIds) } },
    relations: { template: true },
  });
  const deliveries = steps.length
    ? await dataSource
        .getRepository(EmailDelivery)
        .find({ where: { step: { id: In(steps.map((s) => s.id)) } } })
    : [];
  const statusByStep = new Map(deliveries.map((d) => [d.stepId, d.status]));
  for (const id of participationIds)
    result.set(id, { steps: [], deliveryStatus: statusByStep });
  for (const step of steps) result.get(step.participationId)?.steps.push(step);
  return result;
}

/** Variables and email counts of one participation (requires p.tournament). */
export function participationEmailSummary(
  p: Participation,
  data: EmailData | undefined,
) {
  const steps = data?.steps ?? [];
  const variables = effectiveVariables(p.tournament.variables, p.variables);
  const { requiredVariables, missingVariables } = participationVariables(
    steps,
    p.tournament.variables,
    p.variables,
  );
  const deliveryOf = (s: EmailStep) => data?.deliveryStatus.get(s.id);
  const upcoming = steps
    .filter((s) => s.status === StepStatus.SCHEDULED && s.resolvedSendAt)
    .map((s) => s.resolvedSendAt!.getTime())
    .sort((a, b) => a - b);
  return {
    variables: p.variables,
    requiredVariables,
    missingVariables,
    emails: {
      total: steps.filter((s) => s.status !== StepStatus.CANCELLED).length,
      scheduled: steps.filter(
        (s) =>
          s.status === StepStatus.SCHEDULED || s.status === StepStatus.PAUSED,
      ).length,
      sent: steps.filter((s) => deliveryOf(s) === DeliveryStatus.SENT).length,
      failed: steps.filter((s) => deliveryOf(s) === DeliveryStatus.FAILED)
        .length,
      ready: steps.filter((s) => deliveryOf(s) === DeliveryStatus.READY).length,
      blocked: steps.filter(
        (s) =>
          UNSENT_STEP_STATUSES.includes(s.status) &&
          missingVariablesOf(s, variables).length > 0,
      ).length,
      nextSendAt: upcoming.length > 0 ? new Date(upcoming[0]) : null,
    },
  };
}

/** Variables a tournament's emails need, and for how many active teams each one is missing. */
export function tournamentVariableSummary(
  tournament: Tournament,
  participations: Participation[],
  emailData: Map<string, EmailData>,
  planTemplates: Map<string, EmailTemplate>,
) {
  const usedBy = new Map<string, Set<string>>();
  const use = (key: string, name: string) =>
    usedBy.set(key, new Set([...(usedBy.get(key) ?? []), name]));
  for (const item of tournament.emailPlan) {
    const template = planTemplates.get(item.templateId);
    const text = `${item.subjectOverride ?? template?.subject ?? ''}\n${template?.bodyHtml ?? ''}`;
    for (const key of findTournamentVars(text)) use(key, item.name);
  }
  const missingFor = new Map<string, number>();
  for (const p of participations.filter(
    (x) => x.status !== ParticipationStatus.WITHDRAWN,
  )) {
    const steps = emailData.get(p.id)?.steps ?? [];
    const { requiredVariables, missingVariables } = participationVariables(
      steps,
      tournament.variables,
      p.variables,
    );
    for (const v of requiredVariables)
      for (const s of v.steps) use(v.key, s.name);
    for (const key of missingVariables)
      missingFor.set(key, (missingFor.get(key) ?? 0) + 1);
  }
  const requiredVariables = [...usedBy.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, names]) => ({
      key,
      hasValue:
        typeof tournament.variables[key] === 'string' &&
        tournament.variables[key].trim() !== '',
      missingFor: missingFor.get(key) ?? 0,
      usedBy: [...names].sort(),
    }));
  return {
    requiredVariables,
    missingVariables: requiredVariables
      .filter((v) => v.missingFor > 0)
      .map((v) => v.key),
  };
}
