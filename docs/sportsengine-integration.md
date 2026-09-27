# SportsEngine integration: what we can sync

> Status: research findings (September 2026) plus a proposed design. Nothing here is implemented yet.
> Sources are listed at the end. **Confirmed** means seen in SportsEngine's docs or live API schema. **Inferred** means our interpretation.

## Summary

- **Access is available to us.** SportsEngine has a current GraphQL API, the Integrations API. Customers "automatically receive access to your organization's data with your client access key and secret", requested by a club admin under *API Settings*. No partner programme is needed. [1][4]
- **RSVPs are not available.** SportsEngine's RSVPs (going / not going on team events) exist in the product but **not in the API**. The schema has no RSVP or attendance type, and the help centre documents no RSVP export either. [2][14][15] So SportsEngine cannot be the automated source of truth for RSVPs in this app; they stay a manual check (see below). Ask SportsEngine support whether RSVP data is reachable at all (open question 5).
- **Messages are not available.** The API can neither read nor send messages, so the communication itself stays in SportsEngine and does not flow back to us. [2]
- **Several process steps can still be derived automatically:** payment status, team and roster existence, the tournament as an event, and completed registration forms (which can be used as the waiver).

## The API in brief (confirmed)

| Item | Detail |
|---|---|
| Endpoint | `POST https://api.sportsengine.com/graphql` with a Bearer token. Schema explorer: https://dev.sportsengine.com/explorer [1][2] |
| Auth | OAuth 2.0 at `user.sportsengine.com`. The best fit for a server is the **Organization Grant**: the connection belongs to the club, not to one admin. Organization tokens live about 41 days. User tokens live 30 min and can be refreshed. [5] |
| Legacy | The old Sport Ngin REST API (`api.sportngin.com`) is "Legacy". Don't build on it. [6][7] |
| Paging | `page` / `perPage` (max 100), with `pageInformation` in every result [10] |
| Rate limits | Set per client key (the example is 100 requests/min). HTTP 429 when exceeded. Queries are also limited by complexity. [17] |
| Webhooks | Create, update and delete for event, team (including roster changes) and registrationResult, plus others. The payload contains **only ids**, so we always re-fetch. Deliveries are batched per minute, order isn't guaranteed, retries run for up to about 2 h, and **there is no signature**. [16] |
| Change policy | At least 90 days' notice for attribute changes and 180 days for query changes [8] |

## Data we could pull

| SportsEngine data | Useful for | Notes |
|---|---|---|
| **Programs** (season or tournament, plus divisions, with dates) [11] | Matching our tournaments; age groups ≈ divisions | Store `programId` on the tournament |
| **Teams** in a program (`teams(programId, tourneyTeams…)`), with **`teamFeeStatus` PAID/UNPAID** and `rosterStatus` | *Paid* and *Added to SportsEngine* | Store `teamId` on our team or participation |
| **Rosters** (`team.players`, `team.staff`) | Roster size and staff | Contains minors' personal data. Store counts and ids only (see Privacy) |
| **Events** (`events(teamId, from, to, source)`: TOURNEY / SEASON_MANAGEMENT, start/end, location, status) [12] | Tournament dates and *Participated* (event date passed, not cancelled) | Writable: `createEvent` could put the tournament on team calendars |
| **Registrations** and **registration results** (`completed`, `status`, `answers`, uploaded documents, `sale`) [13] | *Waiver submission confirmed*, if the waiver is collected as a SportsEngine registration or form | Inferred: there's no separate waiver object; the waiver is a registration form |
| **Payments / sale items** (`paidAmount`, `remainingAmount`, `status`) | *Paid*, if fees are per player rather than per team | |
| ~~RSVPs / attendance~~ | — | **Not in the API** |
| ~~Messages~~ | — | **Not in the API** |

## Proposed mapping to our participation process

| Step | Automatic from SportsEngine? | Rule (proposal) |
|---|---|---|
| Signed up | Partly | Team appears in the tournament program (`tourneyTeams`). Otherwise manual. |
| Paid | **Yes** | `team.teamFeeStatus = PAID`, or all sale items with `remainingAmount = 0` |
| Added to SportsEngine | **Yes** | Team exists under the tournament program, or a TOURNEY event exists for the team |
| Added to staff calendar | Partly | Event exists on the team calendar. Whether it is on the *staff's* calendar stays a manual confirmation. |
| Roster confirmed with families | **No** | Manual. RSVPs aren't in the API. `rosterStatus = APPROVED` only covers the official roster. |
| Waiver request sent | **No** | Manual. Messages aren't in the API. |
| Waiver submission confirmed | **Yes, if** waivers are SportsEngine forms | All roster players have `registrationResult.completed = true` |
| Participated | Partly | Event end date passed and status not cancelled, then confirmed manually |

**Automatic steps only move forward.** A sync would propose or apply "advance to X" through the existing state machine, recorded with a note like "via SportsEngine". It would never move a status backwards, and a manual status always stays possible.

## Sync design (for when we build it)

1. **Connect:** a club admin requests the client key and secret. We store them as env secrets and use the Organization Grant.
2. **Map ids:** add optional fields `sportsEngineProgramId` (tournament), `sportsEngineTeamId` (team) and possibly `sportsEngineEventId` (participation), and a one-time mapping screen with a name-matching suggestion.
3. **Pull:**
   - A nightly job fetches programs, teams (fee status, roster status), events in the window from 90 days before to 7 days after each tournament, and registration results.
   - It computes suggested status advances and applies them only for the automatic steps above.
   - Every change goes through the normal transition endpoint, so history and the work queue stay correct.
4. **Webhooks:** team, event and registrationResult webhooks only trigger an early re-fetch of that one object. Because the payload is unsigned, the endpoint uses an unguessable URL and never trusts the payload's content.
5. **Privacy:** store only SportsEngine ids, names, counts and statuses. Never store minors' birth dates, addresses or guardian contacts.
6. **Fallbacks without API access:**
   - Team **iCal feeds** (`https://<site>/ical_feed?tags=<ids>`, refreshed about every 30 min) can confirm that the tournament event exists. Which event fields the feeds include is unverified. [19][20]
   - **CSV exports** of members and registrations can be imported by hand. None of them include RSVPs. [21][22]

## Open questions for the club

1. Which SportsEngine products does the club use (HQ, Registration, Season, Sport or Tourney Management), and is the API included at no extra cost?
2. Can a club admin request the API client key and secret? Which admin role does that need?
3. Are waivers collected as SportsEngine registrations or forms, or in another tool?
4. Are tournaments set up as SportsEngine programs, as team calendar events, or not at all?
5. Can SportsEngine support expose RSVP data through any API or export? If not, "Roster confirmed" stays manual.
6. Is "paid" a team fee or per-player fees?
7. Agree a data-minimisation rule for minors' data before any sync is built.

## Sources
1. https://help.sportsengine.com/en/articles/8225304-getting-started-with-api
2. https://api.sportsengine.com/graphql (live schema introspection) · https://dev.sportsengine.com/explorer
3. https://www.sportsengine.com/blog/admin-topics-product-release-internal-use-managing-operations/new-release-integrations-api/
4. https://help.sportsengine.com/en/articles/8677002-frequently-asked-questions-for-api
5. https://help.sportsengine.com/en/articles/8891727-authenticating-with-sportsengine
6. https://dev.sportsengine.com/v1/Registration.html
7. https://developer-v1.sportsengine.com/page/registration-api.md
8. https://help.sportsengine.com/en/articles/8549090-changes-and-deprecations-to-the-schema
10. https://help.sportsengine.com/en/articles/8225747-completing-your-first-graphql-query
11. https://help.sportsengine.com/en/articles/8336934-navigating-teams-and-rosters
12. https://help.sportsengine.com/en/articles/8261039-working-with-events-and-mutations
13. https://help.sportsengine.com/en/articles/8418009-getting-registrations-and-results
14. https://help.sportsengine.com/en/articles/6329452-how-to-view-my-team-rsvps
15. https://help.sportsengine.com/en/articles/6329219-how-do-i-send-rsvps
16. https://help.sportsengine.com/en/articles/8346198-leveraging-webhooks-for-data-changes
17. https://help.sportsengine.com/en/articles/9823645-public-api-rate-limiting
19. https://help.sportsengine.com/en/articles/6307106-how-to-subscribe-to-an-ical-feed
20. https://xhl.sportngin.com/event/ical_instructions?tags=7513306
21. https://help.sportsengine.com/en/articles/6310277-how-to-view-and-export-member-data
22. https://help.sportsengine.com/en/articles/6338722-how-do-i-export-all-my-club-or-league-games-to-a-csv-file
