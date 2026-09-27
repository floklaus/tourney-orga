import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { DataSource, In, Not } from 'typeorm';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../delivery/email-delivery.entity';
import { QuotaService } from '../delivery/quota.service';
import {
  EmailStep,
  StepStatus,
  UNSENT_STEP_STATUSES,
} from '../email/email-step.entity';
import { effectiveVariables, missingVariablesOf } from '../email/variables';
import { SendingMode } from '../settings/setting.entity';
import { SettingsService } from '../settings/settings.service';
import { ParticipationStatus } from '../tournament/domain/participation-process';
import { toParticipationResponse } from '../tournament/participation.mapper';
import { ParticipationService } from '../tournament/participation.service';

export type AttentionType =
  | 'SENDING_PAUSED'
  | 'MISSING_VARIABLES'
  | 'PAST_DUE'
  | 'READY_TO_SEND'
  | 'FAILED_DELIVERIES'
  | 'DUE_SOON'
  | 'PARTICIPATION_OVERDUE'
  | 'PARTICIPATION_DUE_SOON';

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AttentionItem {
  id: string;
  type: AttentionType;
  severity: Severity;
  title: string;
  description: string;
  dueAt: Date | null;
  tournament: { id: string; name: string } | null;
  step: { id: string; name: string } | null;
  count: number | null;
  details: Record<string, unknown>;
}

const HOUR_MS = 60 * 60 * 1000;
const URGENT_WINDOW_MS = 48 * HOUR_MS;
const DUE_SOON_WINDOW_MS = 24 * HOUR_MS;
const PARTICIPATION_DUE_SOON_DAYS = 3;
const PARTICIPATION_URGENT_DAYS = 14;
const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / (24 * HOUR_MS));
const earliest = (dates: (Date | null)[]) =>
  dates
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items)
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()];
};

/** Collects everything the organizer should act on, aggregated per tournament. */
@Injectable()
export class AttentionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly participations: ParticipationService,
    private readonly quota: QuotaService,
    private readonly settings: SettingsService,
  ) {}

  async list(now = new Date()) {
    const mode = await this.settings.currentMode();
    const unsent = await this.dataSource.getRepository(EmailStep).find({
      where: {
        status: In(UNSENT_STEP_STATUSES),
        participation: { status: Not(ParticipationStatus.WITHDRAWN) },
      },
      relations: {
        template: true,
        participation: { tournament: true, team: true },
      },
      order: { resolvedSendAt: { direction: 'ASC', nulls: 'LAST' } },
    });
    const items: AttentionItem[] = [
      ...(await this.pausedItem(now)),
      ...this.missingVariableItems(unsent, now),
      ...this.stepItems(unsent, mode, now),
      ...(await this.deliveryItems()),
      ...(await this.participationItems()),
    ];
    // A sending pause blocks everything, so it always comes first.
    const pinned = (i: AttentionItem) => (i.type === 'SENDING_PAUSED' ? 0 : 1);
    items.sort(
      (a, b) =>
        pinned(a) - pinned(b) ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
    );
    const count = (s: Severity) => items.filter((i) => i.severity === s).length;
    return {
      items,
      counts: {
        high: count('HIGH'),
        medium: count('MEDIUM'),
        low: count('LOW'),
        total: items.length,
      },
    };
  }

  private async pausedItem(now: Date): Promise<AttentionItem[]> {
    const { pausedUntil, pauseReason } = await this.quota.current(now);
    if (!pausedUntil) return [];
    return [
      {
        id: 'SENDING_PAUSED:global',
        type: 'SENDING_PAUSED',
        severity: 'HIGH',
        title: 'Automatic sending is paused',
        description: `${pauseReason ?? 'The mail server reported a problem'}. Queued emails wait until sending resumes.`,
        dueAt: pausedUntil,
        tournament: null,
        step: null,
        count: null,
        details: { pausedUntil, reason: pauseReason },
      },
    ];
  }

  /** Per tournament: teams whose emails miss variable values. */
  private missingVariableItems(
    unsent: EmailStep[],
    now: Date,
  ): AttentionItem[] {
    const affected = unsent
      .map((step) => {
        const { participation: p } = step;
        return {
          step,
          missing: missingVariablesOf(
            step,
            effectiveVariables(p.tournament.variables, p.variables),
          ),
        };
      })
      .filter((a) => a.missing.length > 0);
    return groupBy(affected, (a) => a.step.participation.tournament.id).map(
      (group): AttentionItem => {
        const tournament = group[0].step.participation.tournament;
        const missing = [...new Set(group.flatMap((a) => a.missing))].sort();
        const dueAt = earliest(group.map((a) => a.step.resolvedSendAt));
        const byParticipation = groupBy(
          group,
          (a) => a.step.participation.id,
        ).map((list) => ({
          id: list[0].step.participation.id,
          teamName: list[0].step.participation.team.name,
          missing: [...new Set(list.flatMap((a) => a.missing))].sort(),
        }));
        return {
          id: `MISSING_VARIABLES:${tournament.id}`,
          type: 'MISSING_VARIABLES',
          severity:
            dueAt && dueAt.getTime() - now.getTime() <= URGENT_WINDOW_MS
              ? 'HIGH'
              : 'MEDIUM',
          title: `Fill in ${plural(missing.length, 'variable')} for ${tournament.name}: ${missing.join(', ')}`,
          description: `${plural(byParticipation.length, 'team')} cannot be emailed until these values are provided.`,
          dueAt,
          tournament: { id: tournament.id, name: tournament.name },
          step: null,
          count: byParticipation.length,
          details: {
            missingVariables: missing,
            participations: byParticipation,
          },
        };
      },
    );
  }

  /** Per tournament and email name: past-due emails, and (manual mode) emails due within 24 h. */
  private stepItems(
    unsent: EmailStep[],
    mode: SendingMode,
    now: Date,
  ): AttentionItem[] {
    const scheduled = unsent.filter((s) => s.status === StepStatus.SCHEDULED);
    const pastDue = scheduled.filter((s) => s.requiresDecision);
    const dueSoon =
      mode === SendingMode.MANUAL
        ? scheduled.filter(
            (s) =>
              !s.requiresDecision &&
              s.resolvedSendAt !== null &&
              s.resolvedSendAt.getTime() - now.getTime() <= DUE_SOON_WINDOW_MS,
          )
        : [];
    const build = (steps: EmailStep[], type: 'PAST_DUE' | 'DUE_SOON') =>
      groupBy(steps, (s) => `${s.participation.tournament.id}:${s.name}`).map(
        (group): AttentionItem => {
          const tournament = group[0].participation.tournament;
          const stepName = group[0].name;
          const teams = group.map((s) => s.participation.team.name).sort();
          return {
            id: `${type}:${tournament.id}:${stepName}`,
            type,
            severity: type === 'PAST_DUE' ? 'HIGH' : 'LOW',
            title:
              type === 'PAST_DUE'
                ? `"${stepName}" is past due for ${plural(group.length, 'team')}`
                : `"${stepName}" is due soon for ${plural(group.length, 'team')}`,
            description:
              type === 'PAST_DUE'
                ? `Its send time at ${tournament.name} has passed. Send it now or skip it.`
                : `These emails at ${tournament.name} will need to be sent manually.`,
            dueAt: earliest(group.map((s) => s.resolvedSendAt)),
            tournament: { id: tournament.id, name: tournament.name },
            step:
              group.length === 1 ? { id: group[0].id, name: stepName } : null,
            count: group.length,
            details: { stepName, stepIds: group.map((s) => s.id), teams },
          };
        },
      );
    return [...build(pastDue, 'PAST_DUE'), ...build(dueSoon, 'DUE_SOON')];
  }

  /** Per tournament: emails ready for manual sending and failed emails. */
  private async deliveryItems(): Promise<AttentionItem[]> {
    const deliveries = await this.dataSource.getRepository(EmailDelivery).find({
      where: { status: In([DeliveryStatus.READY, DeliveryStatus.FAILED]) },
      relations: { team: true, step: { participation: { tournament: true } } },
    });
    return groupBy(
      deliveries,
      (d) => `${d.step.participation.tournament.id}:${d.status}`,
    ).map((group): AttentionItem => {
      const tournament = group[0].step.participation.tournament;
      const teams = [
        ...new Set(group.map((d) => d.team?.name ?? d.toEmail)),
      ].sort();
      const ready = group[0].status === DeliveryStatus.READY;
      return {
        id: `${ready ? 'READY_TO_SEND' : 'FAILED_DELIVERIES'}:${tournament.id}`,
        type: ready ? 'READY_TO_SEND' : 'FAILED_DELIVERIES',
        severity: ready ? 'HIGH' : 'MEDIUM',
        title: ready
          ? `Send ${plural(group.length, 'email')} for ${tournament.name}`
          : `${plural(group.length, 'email')} for ${tournament.name} failed`,
        description: ready
          ? 'Prepared for manual sending: copy each email, send it and mark it as sent.'
          : 'Resend them, send them manually, or dismiss them.',
        dueAt: null,
        tournament: { id: tournament.id, name: tournament.name },
        step: null,
        count: group.length,
        details: ready
          ? { count: group.length, teams }
          : { deliveryIds: group.map((d) => d.id), teams },
      };
    });
  }

  /** Participation process steps that are overdue or due within 3 days, per tournament and step. */
  private async participationItems(): Promise<AttentionItem[]> {
    const clock = await this.participations.clock();
    const responses = (await this.participations.findAll())
      .map((entity) => toParticipationResponse(entity, clock))
      .filter(
        (p) =>
          p.nextStatus &&
          p.daysUntilDue !== null &&
          (p.overdue || p.daysUntilDue <= PARTICIPATION_DUE_SOON_DAYS),
      );
    return groupBy(
      responses,
      (p) => `${p.tournament.id}:${p.nextStatus}:${p.overdue}`,
    ).map((list): AttentionItem => {
      const first = list[0];
      const step = first.steps.find((s) => s.status === first.nextStatus)!;
      const overdue = first.overdue;
      const daysToStart = daysBetween(clock.today, first.tournament.startDate);
      // Urgent only before an upcoming tournament; a missing confirmation afterwards is less pressing.
      const startsSoon =
        daysToStart >= 0 && daysToStart <= PARTICIPATION_URGENT_DAYS;
      const teams = plural(list.length, 'team');
      return {
        id: `${overdue ? 'PARTICIPATION_OVERDUE' : 'PARTICIPATION_DUE_SOON'}:${first.tournament.id}:${step.status}`,
        type: overdue ? 'PARTICIPATION_OVERDUE' : 'PARTICIPATION_DUE_SOON',
        severity: overdue ? (startsSoon ? 'HIGH' : 'MEDIUM') : 'LOW',
        title: overdue
          ? `${teams} overdue for "${step.label}" at ${first.tournament.name}`
          : `${teams} due for "${step.label}" at ${first.tournament.name}`,
        description: list.map((p) => p.team.name).join(', '),
        // Due dates are calendar days: the step is due until the end of that day (organizer timezone).
        dueAt: DateTime.fromISO(step.dueDate, { zone: clock.timezone })
          .endOf('day')
          .toJSDate(),
        tournament: { id: first.tournament.id, name: first.tournament.name },
        step: null,
        count: list.length,
        details: {
          status: step.status,
          label: step.label,
          dueDate: step.dueDate,
          participations: list.map((p) => ({
            id: p.id,
            teamId: p.team.id,
            teamName: p.team.name,
          })),
        },
      };
    });
  }
}
