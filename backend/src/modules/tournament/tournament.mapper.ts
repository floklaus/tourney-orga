import {
  dueDateOf,
  ParticipationStatus,
  STATUS_LABELS,
} from './domain/participation-process';
import { EmailTemplate } from '../template/email-template.entity';
import { tournamentVariableSummary } from './participation-emails';
import { timingOf } from './tournament-clock';
import { Tournament } from './tournament.entity';

/** Requires participations loaded (for counts). */
export interface TournamentExtras {
  planTemplates: Map<string, EmailTemplate>;
  variables: ReturnType<typeof tournamentVariableSummary>;
}

export function toTournamentResponse(
  t: Tournament,
  today: string,
  extras?: TournamentExtras,
) {
  const statusCounts = Object.fromEntries(
    Object.values(ParticipationStatus).map((s) => [s, 0]),
  ) as Record<ParticipationStatus, number>;
  for (const p of t.participations ?? []) statusCounts[p.status]++;
  return {
    id: t.id,
    name: t.name,
    url: t.url,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    ageGroups: t.ageGroups,
    timing: timingOf(t, today),
    milestones: t.milestones.map((m) => ({
      ...m,
      label: STATUS_LABELS[m.status],
      dueDate: dueDateOf(m, t),
    })),
    participantCount: (t.participations ?? []).filter(
      (p) => p.status !== ParticipationStatus.WITHDRAWN,
    ).length,
    statusCounts,
    variables: t.variables,
    emailPlan: t.emailPlan.map((item) => ({
      ...item,
      templateName: extras?.planTemplates.get(item.templateId)?.name ?? null,
    })),
    requiredVariables: extras?.variables.requiredVariables ?? [],
    missingVariables: extras?.variables.missingVariables ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export type TournamentResponse = ReturnType<typeof toTournamentResponse>;
