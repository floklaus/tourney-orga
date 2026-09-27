import { randomUUID } from 'node:crypto';
import { EntityManager, In } from 'typeorm';
import { unprocessable } from '../../common/errors';
import { EmailTemplate } from '../template/email-template.entity';
import { Participation } from '../tournament/participation.entity';
import { Tournament } from '../tournament/tournament.entity';
import { User } from '../user/user.entity';
import { isPastDue } from './domain/schedule';
import { Anchor, resolveSendAt, TournamentDates } from './domain/send-time';
import {
  EDITABLE_STEP_STATUSES,
  EmailStep,
  StepStatus,
  TimingType,
} from './email-step.entity';

/** One planned email of a tournament; copied into every participation's email steps. */
export interface EmailPlanItem {
  id: string;
  name: string;
  templateId: string;
  subjectOverride: string | null;
  timingType: TimingType;
  sendAt: string | null;
  offsetDays: number | null;
  timeOfDay: string | null;
  anchor: Anchor;
}

export type EmailPlanInput = Omit<
  EmailPlanItem,
  'id' | 'subjectOverride' | 'anchor'
> & {
  id?: string;
  subjectOverride?: string | null;
  anchor?: Anchor;
};

/** Validates plan items against existing templates and completes ids/defaults. */
export async function normalizeEmailPlan(
  em: EntityManager,
  items: EmailPlanInput[],
): Promise<EmailPlanItem[]> {
  const templateIds = [...new Set(items.map((i) => i.templateId))];
  const found = templateIds.length
    ? await em.findBy(EmailTemplate, { id: In(templateIds) })
    : [];
  const missing = templateIds.filter((id) => !found.some((t) => t.id === id));
  if (missing.length > 0)
    throw unprocessable('Unknown template(s) in the email plan', {
      templateIds: missing,
    });
  return items.map((item) => {
    const timing = checkTiming(item);
    return {
      id: item.id ?? randomUUID(),
      name: item.name.trim(),
      templateId: item.templateId,
      subjectOverride: item.subjectOverride || null,
      ...timing,
      sendAt: timing.sendAt?.toISOString() ?? null,
    };
  });
}

/** Normalized timing fields; throws 422 when a timing type misses its fields. */
export function checkTiming(input: {
  timingType: TimingType;
  sendAt?: string | Date | null;
  offsetDays?: number | null;
  timeOfDay?: string | null;
  anchor?: Anchor;
}) {
  if (input.timingType === TimingType.ABSOLUTE) {
    if (!input.sendAt)
      throw unprocessable('sendAt is required for emails at a fixed time');
    return {
      timingType: input.timingType,
      sendAt: new Date(input.sendAt),
      offsetDays: null,
      timeOfDay: null,
      anchor: 'START' as Anchor,
    };
  }
  if (
    input.offsetDays === null ||
    input.offsetDays === undefined ||
    !input.timeOfDay
  ) {
    throw unprocessable(
      'offsetDays and timeOfDay are required for emails relative to the tournament',
    );
  }
  return {
    timingType: input.timingType,
    sendAt: null,
    offsetDays: input.offsetDays,
    timeOfDay: input.timeOfDay,
    anchor: input.anchor ?? 'START',
  };
}

/** Resolved send time and past-due flag for a step (only scheduled steps can be past due). */
export function scheduleFields(
  step: Pick<
    EmailStep,
    'timingType' | 'sendAt' | 'offsetDays' | 'timeOfDay' | 'anchor' | 'status'
  >,
  tournament: TournamentDates,
  timezone: string,
) {
  const resolvedSendAt = resolveSendAt(step, tournament, timezone);
  return {
    resolvedSendAt,
    requiresDecision: isPastDue(
      resolvedSendAt,
      step.status === StepStatus.SCHEDULED,
    ),
  };
}

/** Creates the participation's steps for the given plan items (skipping ones it already has). */
export async function createStepsFromPlan(
  em: EntityManager,
  participation: Pick<Participation, 'id'>,
  tournament: Tournament,
  items: EmailPlanItem[],
  timezone: string,
  user: User | null,
): Promise<number> {
  const existing = await em.find(EmailStep, {
    where: { participation: { id: participation.id } },
    select: { planItemId: true },
  });
  const have = new Set(existing.map((s) => s.planItemId));
  const missing = items.filter((item) => !have.has(item.id));
  for (const item of missing) {
    const timing = {
      ...item,
      sendAt: item.sendAt ? new Date(item.sendAt) : null,
      status: StepStatus.SCHEDULED,
    };
    await em.insert(EmailStep, {
      participation: { id: participation.id },
      planItemId: item.id,
      name: item.name,
      template: { id: item.templateId },
      subjectOverride: item.subjectOverride,
      timingType: item.timingType,
      sendAt: timing.sendAt,
      offsetDays: item.offsetDays,
      timeOfDay: item.timeOfDay,
      anchor: item.anchor,
      status: StepStatus.SCHEDULED,
      ...scheduleFields(timing, tournament, timezone),
      createdBy: user ? { id: user.id } : null,
      updatedBy: user ? { id: user.id } : null,
    });
  }
  return missing.length;
}

/** After tournament date changes: move every unsent relative step of its participations. */
export async function rescheduleTournamentSteps(
  em: EntityManager,
  tournament: Tournament,
  timezone: string,
): Promise<void> {
  const steps = await em.find(EmailStep, {
    where: {
      participation: { tournament: { id: tournament.id } },
      status: In(EDITABLE_STEP_STATUSES),
      timingType: TimingType.RELATIVE,
    },
  });
  for (const step of steps)
    await em.update(
      EmailStep,
      step.id,
      scheduleFields(step, tournament, timezone),
    );
}
