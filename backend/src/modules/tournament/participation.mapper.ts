import { ageGroupFor } from '../team/domain/age-group';
import { toUserRef } from '../user/user.mapper';
import { computeSteps } from './domain/participation-process';
import {
  Participation,
  ParticipationStatusChange,
} from './participation.entity';
import { EmailData, participationEmailSummary } from './participation-emails';
import { timingOf } from './tournament-clock';

export interface ClockContext {
  today: string;
  timezone: string;
  seasonStartMonth: number;
}

/** Requires tournament, team and history loaded. */
export function toParticipationResponse(
  p: Participation,
  clock: ClockContext,
  emails?: EmailData,
) {
  const history = historyForProgress(p.history ?? []);
  const progress = computeSteps(
    p.status,
    p.tournament.milestones,
    p.tournament,
    history,
    clock.today,
    clock.timezone,
  );
  return {
    id: p.id,
    tournament: {
      id: p.tournament.id,
      name: p.tournament.name,
      startDate: p.tournament.startDate,
      endDate: p.tournament.endDate,
      timing: timingOf(p.tournament, clock.today),
    },
    team: {
      id: p.team.id,
      name: p.team.name,
      graduationYear: p.team.graduationYear,
      /** Calculated for the tournament's start date. */
      ageGroup: ageGroupFor(
        p.team.graduationYear,
        p.tournament.startDate,
        clock.seasonStartMonth,
      ),
    },
    ageGroup: p.ageGroup,
    days: p.days,
    status: p.status,
    ...progress,
    notes: p.notes,
    ...participationEmailSummary(p, emails),
    withdrawnAt: p.withdrawnAt,
    version: p.version,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export type ParticipationResponse = ReturnType<typeof toParticipationResponse>;

export const toStatusChangeResponse = (c: ParticipationStatusChange) => ({
  id: c.id,
  fromStatus: c.fromStatus,
  toStatus: c.toStatus,
  note: c.note,
  changedBy: toUserRef(c.changedBy),
  changedAt: c.changedAt,
});

export const sortedHistory = <T extends { changedAt: Date }>(history: T[]) =>
  [...history].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

export const historyForProgress = (history: ParticipationStatusChange[]) =>
  sortedHistory(history).map((h) => ({
    toStatus: h.toStatus,
    changedAt: h.changedAt,
  }));
