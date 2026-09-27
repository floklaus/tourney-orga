import { ListSpec, tags } from '../../common/list/list-spec';
import { GroupResponse } from './group.service';
import { toTeamResponse } from './team.mapper';

export type TeamListItem = ReturnType<typeof toTeamResponse> & {
  tournaments: { id: string; name: string }[];
};

export const TEAM_LIST_SPEC: ListSpec<TeamListItem> = {
  search: (t) => [t.name, t.contactName, t.email, ...t.ccEmails],
  filters: [
    {
      key: 'ageGroup',
      label: 'Age group',
      type: 'tag',
      values: (t) => tags(t.ageGroup ? [t.ageGroup] : []),
    },
    {
      key: 'graduationYear',
      label: 'Graduation year',
      type: 'tag',
      values: (t) => tags(t.graduationYear ? [String(t.graduationYear)] : []),
    },
    {
      key: 'group',
      label: 'Group',
      type: 'ref',
      values: (t) => t.groups.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      key: 'archived',
      label: 'Archived',
      type: 'boolean',
      values: (t) => [t.isArchived],
    },
    {
      key: 'subscription',
      label: 'Subscription',
      type: 'enum',
      options: [
        { value: 'SUBSCRIBED', label: 'Subscribed' },
        { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
      ],
      values: (t) => [t.unsubscribedAt ? 'UNSUBSCRIBED' : 'SUBSCRIBED'],
    },
    {
      key: 'tournament',
      label: 'Tournament',
      type: 'ref',
      values: (t) => t.tournaments.map((x) => ({ value: x.id, label: x.name })),
    },
  ],
  sorts: {
    name: (t) => t.name,
    contactName: (t) => t.contactName,
    email: (t) => t.email,
    graduationYear: (t) => t.graduationYear,
    // Youngest first: a later graduation year is a younger age group
    ageGroup: (t) => (t.graduationYear === null ? null : -t.graduationYear),
    createdAt: (t) => t.createdAt,
    updatedAt: (t) => t.updatedAt,
  },
  defaultSort: 'name',
  defaultFilters: { archived: ['false'] },
};

export const GROUP_LIST_SPEC: ListSpec<GroupResponse> = {
  search: (g) => [g.name, g.description],
  filters: [],
  sorts: { name: (g) => g.name, teamCount: (g) => g.teamCount },
  defaultSort: 'name',
};
