import { ageGroupFor, SeasonClock } from './domain/age-group';
import { Team } from './team.entity';

export const toTeamResponse = (team: Team, season: SeasonClock) => ({
  id: team.id,
  name: team.name,
  contactName: team.contactName,
  email: team.email,
  ccEmails: team.ccEmails,
  graduationYear: team.graduationYear,
  ageGroup: ageGroupFor(
    team.graduationYear,
    season.today,
    season.seasonStartMonth,
  ),
  notes: team.notes,
  isArchived: team.isArchived,
  unsubscribedAt: team.unsubscribedAt,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt,
});
