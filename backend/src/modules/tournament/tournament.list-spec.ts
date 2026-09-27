import { DateTime } from 'luxon';
import { ListSpec, tags } from '../../common/list/list-spec';
import {
  PROCESS,
  ParticipationStatus,
  STATUS_LABELS,
} from './domain/participation-process';
import { ParticipationResponse } from './participation.mapper';
import { TournamentResponse } from './tournament.mapper';

const dayLabel = (day: string) =>
  DateTime.fromISO(day).setLocale('en-US').toFormat('ccc, LLL d, yyyy');

export const TIMING_OPTIONS = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'PAST', label: 'Past' },
];

export const TOURNAMENT_LIST_SPEC: ListSpec<TournamentResponse> = {
  search: (t) => [t.name, t.description, t.url],
  filters: [
    {
      key: 'ageGroup',
      label: 'Age group',
      type: 'tag',
      values: (t) => tags(t.ageGroups),
    },
    {
      key: 'timing',
      label: 'Timing',
      type: 'enum',
      options: TIMING_OPTIONS,
      values: (t) => [t.timing],
    },
    {
      key: 'year',
      label: 'Year',
      type: 'tag',
      values: (t) => tags([t.startDate.slice(0, 4)]),
    },
  ],
  sorts: {
    startDate: (t) => t.startDate,
    name: (t) => t.name,
    participantCount: (t) => t.participantCount,
  },
  defaultSort: 'startDate',
};

const STATUS_OPTIONS = [...PROCESS, ParticipationStatus.WITHDRAWN].map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));
const statusOrder = (s: ParticipationStatus) =>
  s === ParticipationStatus.WITHDRAWN ? 99 : PROCESS.indexOf(s);

export const PARTICIPATION_LIST_SPEC: ListSpec<ParticipationResponse> = {
  search: (p) => [p.team.name, p.tournament.name, p.notes],
  filters: [
    {
      key: 'tournament',
      label: 'Tournament',
      type: 'ref',
      values: (p) => [{ value: p.tournament.id, label: p.tournament.name }],
    },
    {
      key: 'team',
      label: 'Team',
      type: 'ref',
      values: (p) => [{ value: p.team.id, label: p.team.name }],
    },
    {
      key: 'ageGroup',
      label: 'Age group',
      type: 'tag',
      values: (p) => tags(p.ageGroup ? [p.ageGroup] : []),
    },
    {
      key: 'day',
      label: 'Day',
      type: 'tag',
      values: (p) => p.days.map((d) => ({ value: d, label: dayLabel(d) })),
    },
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: STATUS_OPTIONS,
      values: (p) => [p.status],
    },
    {
      key: 'overdue',
      label: 'Overdue',
      type: 'boolean',
      values: (p) => [p.overdue],
    },
    {
      key: 'timing',
      label: 'Tournament timing',
      type: 'enum',
      options: TIMING_OPTIONS,
      values: (p) => [p.tournament.timing],
    },
    {
      key: 'missingVariables',
      label: 'Missing variables',
      type: 'boolean',
      values: (p) => [p.missingVariables.length > 0],
    },
    {
      key: 'emailsReady',
      label: 'Emails ready to send',
      type: 'boolean',
      values: (p) => [p.emails.ready > 0],
    },
    {
      key: 'emailsFailed',
      label: 'Emails failed',
      type: 'boolean',
      values: (p) => [p.emails.failed > 0],
    },
  ],
  sorts: {
    nextDueDate: (p) => p.nextDueDate,
    tournament: (p) => `${p.tournament.startDate} ${p.tournament.name}`,
    team: (p) => p.team.name,
    status: (p) => statusOrder(p.status),
  },
  defaultSort: 'nextDueDate',
};
