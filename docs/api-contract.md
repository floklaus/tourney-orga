# API Contract (v1)

Base path: `/api/v1`. JSON in and out. The frontend calls it via a Next.js rewrite of `/api/*` to the backend, so the session cookie is same-origin.

## Conventions

**Envelope** (every JSON response):
```json
{ "success": true, "data": <payload|null>, "error": null, "meta": { "total": 42, "page": 1, "limit": 25 } }
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```
`meta` only appears on paginated lists. Error codes: `VALIDATION_ERROR` (400/422), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

**Auth:** `POST /auth/login` sets an httpOnly cookie `session` (JWT, 12 h) and a readable cookie `csrf_token`. Every non-GET request (except `/auth/login`, `/auth/password-reset/*`, `/invitations/accept` and `/public/*`) must send the header `X-CSRF-Token: <csrf_token cookie value>`.

**Optional fields:** omitting a field leaves it unchanged. `null` is only accepted for fields typed `| null`; sending `null` for any other field is a 400.

**Types:** timestamps are ISO-8601 UTC strings. IDs are UUIDs. Pagination query: `page` (default 1), `limit` (default 25, max 100).

## Types

```ts
type User = { id; email; firstName; lastName; isActive: boolean; lastLoginAt: string|null; createdAt }
type Invitation = { id; email; invitedBy: {id, firstName, lastName}; expiresAt; acceptedAt: string|null; revokedAt: string|null; createdAt }
type Team = { id; name; contactName; email; ccEmails: string[]; notes: string|null; isArchived: boolean;
              unsubscribedAt: string|null; groups: {id, name}[]; createdAt; updatedAt }
type TeamGroup = { id; name; description: string|null; teamCount: number }
type EmailTemplate = { id; name; subject; bodyHtml; bodyText; createdAt; updatedAt }
type CampaignStatus = 'DRAFT'|'ACTIVE'|'COMPLETED'|'ARCHIVED'
type StepStatus = 'DRAFT'|'SCHEDULED'|'PAUSED'|'SENDING'|'SENT'|'FAILED'|'CANCELLED'
type Campaign = { id; name; description: string|null; referenceDate: string|null; timezone: string;
                  variables: Record<string,string>; status: CampaignStatus; audienceGroups: {id,name}[];
                  steps: Step[] /* only on GET /campaigns/:id */; stepCount: number; nextSendAt: string|null;
                  createdBy: {id, firstName, lastName}|null; createdAt; updatedAt }
type Step = { id; campaignId: string|null; name; templateId: string|null; templateName: string|null;
              subjectOverride: string|null; bodyHtmlOverride: string|null;
              timingType: 'ABSOLUTE'|'RELATIVE'; sendAt: string|null; offsetDays: number|null; timeOfDay: string|null /* "HH:mm" */;
              resolvedSendAt: string|null; status: StepStatus; isPastDue: boolean;
              audienceGroups: {id,name}[]; audienceTeams: {id,name}[];
              counts: { expected: number; queued: number; sent: number; failed: number; skipped: number };
              sentAt: string|null; version: number; createdBy; updatedBy; createdAt; updatedAt }
type DeliveryStatus = 'QUEUED'|'SENT'|'FAILED'|'SKIPPED'
type Delivery = { id; stepId; team: {id, name} | null /* null once the team was deleted */; toEmail; ccEmails: string[]; renderedSubject; status: DeliveryStatus;
                  attempts; lastError: string|null; skipReason: string|null; sentAt: string|null;
                  triggeredBy: {id, firstName, lastName}|null; createdAt }
type Settings = { organizerName; senderName; senderEmail /* read-only, from env */; replyToEmail: string|null;
                  timezone; footerHtml: string|null; logoUrl: string|null; ratePerMinute: number; dailyRecipientCap: number;
                  authMode: 'OAUTH2'|'APP_PASSWORD'|'SMTP' /* read-only */ }
type Quota = { used: number; cap: number; remaining: number; pausedUntil: string|null; pauseReason: string|null }
```

## Endpoints

### Auth & invitations (public unless noted)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /auth/login | `{email, password}` | `User` + cookies |
| POST | /auth/logout | — (auth) | `null` |
| GET | /auth/me | — (auth) | `User` |
| POST | /auth/password-reset/request | `{email}` | `null` (always 200) |
| POST | /auth/password-reset/confirm | `{token, password}` | `null` |
| GET | /invitations/:token | — | `{email, expiresAt}` or 404/409 |
| POST | /invitations/accept | `{token, firstName, lastName, password}` | `User` + cookies |

Passwords must be at least 12 characters. `POST /auth/logout` ends only the current device's session. A password reset or deactivation ends all sessions.

### Users (auth)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /users | — | `User[]` |
| PATCH | /users/:id | `{isActive}` | `User` (409 if self or last active admin) |
| GET | /users/invitations | — | `Invitation[]` (pending only) |
| POST | /users/invitations | `{email}` | `Invitation` |
| POST | /users/invitations/:id/resend | — | `Invitation` |
| DELETE | /users/invitations/:id | — | `null` |

### Teams & groups (auth)
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | /teams | `?search&groupId&includeArchived=true&page&limit` | `Team[]` + meta |
| POST | /teams | `{name, contactName, email, ccEmails?, notes?, groupIds?}` | `Team` |
| GET | /teams/:id | — | `Team` |
| PATCH | /teams/:id | any of `{name, contactName, email, ccEmails, notes, groupIds, isArchived}` | `Team` |
| DELETE | /teams/:id | — | `null` (past deliveries anonymized) |
| POST | /teams/:id/resubscribe | — | `Team` |
| POST | /teams/import | `{csv: string, mode: 'create'\|'upsert', dryRun: boolean}` | `{created, updated, errors: {row, message}[]}` |
| GET | /teams/export | — | `text/csv` (not enveloped) |
| GET | /groups | — | `TeamGroup[]` |
| POST | /groups | `{name, description?}` | `TeamGroup` |
| PATCH | /groups/:id | `{name?, description?}` | `TeamGroup` |
| DELETE | /groups/:id | — | `null` |

CSV columns: `name,contactName,email,ccEmails,groups`. `ccEmails` and `groups` are separated by `;`, and unknown groups are created.

### Templates (auth)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /templates | — | `EmailTemplate[]` |
| GET | /templates/placeholders | — | `{key, description}[]` |
| POST | /templates | `{name, subject, bodyHtml}` | `EmailTemplate` (422 on unknown placeholder) |
| GET | /templates/:id | — | `EmailTemplate` |
| PATCH | /templates/:id | `{name?, subject?, bodyHtml?}` | `EmailTemplate` |
| DELETE | /templates/:id | — | `null` (409 if used by an unsent step) |
| POST | /templates/:id/duplicate | — | `EmailTemplate` |
| POST | /templates/preview | `{subject, bodyHtml, teamId?, campaignId?}` | `{subject, html, text}` (sample data if no team/campaign) |
| POST | /templates/test-send | `{subject, bodyHtml, teamId?, campaignId?}` | `null` (sends to the logged-in user) |

### Campaigns & steps (auth)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /campaigns | `?status` | `Campaign[]` (without steps) |
| POST | /campaigns | `{name, description?, referenceDate?, timezone?, variables?, audienceGroupIds}` | `Campaign` |
| GET | /campaigns/:id | — | `Campaign` with `steps` sorted by `resolvedSendAt` |
| PATCH | /campaigns/:id | same fields, all optional | `Campaign` (reference date moves unsent relative steps) |
| POST | /campaigns/:id/reference-date/preview | `{referenceDate}` | `{stepId, name, before, after}[]` |
| POST | /campaigns/:id/activate | — | `{campaign: Campaign, pastDueSteps: Step[]}` (422 lists missing `campaign.vars`) |
| POST | /campaigns/:id/archive | — | `Campaign` |
| POST | /campaigns/:id/duplicate | — | `Campaign` (DRAFT, no reference date) |
| DELETE | /campaigns/:id | — | `null` (only DRAFT, or ARCHIVED with no sent steps) |
| POST | /campaigns/:id/steps | `{name, templateId, subjectOverride?, timingType, sendAt?, offsetDays?, timeOfDay?, audienceGroupIds?}` | `Step` |
| PATCH | /steps/:id | same fields, all optional, plus **`version`** (required) | `Step` (409 if the version or status changed in the meantime, 422 if the change would break a live step) |
| DELETE | /steps/:id | — | `null` (only DRAFT/PAUSED/CANCELLED) |
| POST | /steps/:id/pause · /resume · /cancel | — | `Step` |
| POST | /steps/:id/send-now | — | `Step` (sends a past-due or scheduled step immediately) |
| POST | /steps/:id/skip | — | `Step` (past-due → CANCELLED) |
| GET | /steps/:id/recipients | — | `{id, name, email, ccEmails, unsubscribed}[]` (who would receive it now; unsubscribed teams are skipped) |
| GET | /steps/:id/deliveries | `?status` | `Delivery[]` |
| POST | /steps/:id/resend-failed | — | `{requeued: number}` |

### Announcements (auth)
An announcement is a step with `campaignId = null`.
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /announcements | — | `Step[]`, newest first |
| POST | /announcements/recipients-preview | `{groupIds, teamIds}` | `{id, name, email, ccEmails, unsubscribed}[]` |
| POST | /announcements | `{name, subject, bodyHtml, groupIds, teamIds, sendAt?}` (no `sendAt` = send now) | `Step` |

### Deliveries & quota (auth)
| Method | Path | Returns |
|---|---|---|
| POST | /deliveries/:id/resend | `Delivery` (409 unless FAILED) |
| POST | /deliveries/resume | `Quota` (clears a sending pause) |
| GET | /deliveries/quota | `Quota` |

### Settings (auth)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /settings | — | `Settings` |
| PATCH | /settings | editable fields | `Settings` |
| POST | /settings/test-email | — | `null` (sends to the logged-in user) |

### Public
| Method | Path | Returns |
|---|---|---|
| GET | /public/unsubscribe/:token | `{teamName, unsubscribed: boolean}` |
| POST | /public/unsubscribe/:token | `{teamName, unsubscribed: true}`. Also the RFC 8058 one-click target (accepts `List-Unsubscribe=One-Click` form body). |
| GET | /health | `{status: 'ok', db: 'ok'}` |

Frontend page for the unsubscribe link in emails: `/unsubscribe/[token]`.

## Manual sending (v1.1)

Automatic sending through Gmail is optional. `Settings.sendingMode`:
- `AUTOMATIC`: due steps are sent via SMTP, as described above.
- `MANUAL`: when a step is due (or on send-now), one delivery per team is created with status **`READY`**. Nothing is sent. The organizer copies each message, sends it from their own mail program, and marks it as sent.

If the server has no mailbox configured (`authMode: 'NONE'`), `automaticSendingAvailable` is false and the mode is always `MANUAL`. PATCHing `AUTOMATIC` returns 422. Test-email endpoints return 409. Invitation emails are not sent, so use `inviteUrl` instead.

A step stays `SENDING` while any delivery is `QUEUED` or `READY`. It becomes `SENT`, or `FAILED` if any delivery failed, once all are done. Switching from `AUTOMATIC` to `MANUAL` turns queued deliveries into `READY`. Resending a failed delivery in `MANUAL` mode also makes it `READY`. Manually sent emails do not count toward the quota.

### Type changes
```ts
type DeliveryStatus = 'QUEUED'|'READY'|'SENT'|'FAILED'|'SKIPPED'
type Delivery = { ...; sentManually: boolean; markedSentBy: {id, firstName, lastName}|null }
type Step = { ...; counts: { expected; queued; ready; sent; failed; skipped } }
type Settings = { ...; sendingMode: 'AUTOMATIC'|'MANUAL'; automaticSendingAvailable: boolean /* read-only */;
                  authMode: 'OAUTH2'|'APP_PASSWORD'|'SMTP'|'NONE' }
type Invitation = { ...; inviteUrl?: string /* only in the POST /users/invitations and /resend responses */ }
type ManualMessage = {
  deliveryId; status: DeliveryStatus;
  to: string; cc: string[]; subject: string;
  html: string;      // message body + footer with unsubscribe link, without the outer email layout (for pasting into a mail program)
  text: string;      // plain-text version
  mailtoUrl: string; // mailto: with to, cc, subject and the plain-text body (may be truncated to ~1800 chars; then `mailtoTruncated`)
  mailtoTruncated: boolean;
}
```

### Endpoints (auth)
| Method | Path | Returns |
|---|---|---|
| GET | /deliveries/:id/message | `ManualMessage`. Rendered with current data for READY/QUEUED/FAILED deliveries, and from the stored snapshot for SENT ones. 409 if the team was deleted. |
| POST | /deliveries/:id/mark-sent | `Delivery`. Allowed from READY or FAILED; sets `SENT` and `sentManually`, and stores the snapshot. |
| POST | /deliveries/:id/mark-unsent | `Delivery`. Undo: a manually sent delivery goes back to READY. |
| POST | /steps/:id/mark-all-sent | `{marked: number}`. Marks every READY delivery of the step as sent. |

## Template-driven variables & work queue (v1.2)

### Variables
A campaign's variables are the `{{campaign.vars.<key>}}` placeholders that its **unsent** steps' email content uses. Unsent means DRAFT, SCHEDULED, PAUSED or SENDING. A step's content is its subject (or subject override) plus its body. `Campaign.variables` still stores the values.

- **Saving is never blocked by missing variables.** Creating or editing steps, templates and campaigns, and activating a campaign, no longer return 422 for missing variables. The other activation checks stay: at least one step, a reference date for relative steps, and an audience.
- **Sending is blocked** while an email's variables are missing. A value counts as missing if it is absent or blank.
  - **Automatic:** a due step with missing variables is not sent. It stays SCHEDULED and appears in the work queue. More than 1 h late, it becomes past-due, as usual. Already queued deliveries are not sent; they keep `lastError = "Waiting for campaign variable(s): …"` and are checked again every 5 minutes.
  - **Manual:** `GET /deliveries/:id/message`, `POST /deliveries/:id/mark-sent` and `POST /steps/:id/mark-all-sent` return **422** with `error.details = { missingVariables: string[] }`.
  - `POST /steps/:id/send-now` returns 422 with the same details.

### Type changes
```ts
type RequiredVariable = { key: string; hasValue: boolean; steps: {id, name}[] }  // which unsent steps use it
type Campaign = { ...;
  requiredVariables: RequiredVariable[];   // GET /campaigns/:id and list; sorted by key
  missingVariables: string[];              // required keys without a value
  unusedVariables: string[];               // keys with a value that no unsent step uses (safe to remove)
}
type Step = { ...; missingVariables: string[] }  // [] for announcements and for sent/cancelled steps
// POST /templates/preview, when campaignId is given: adds `missingVariables: string[]`
```

### Work queue
`GET /attention` → `{ items: AttentionItem[], counts: { high: number, medium: number, low: number, total: number } }`

```ts
type AttentionType =
  | 'SENDING_PAUSED'          // global: Gmail limit/auth problem (details: {pausedUntil, reason})
  | 'MISSING_VARIABLES'       // per campaign (details: {missingVariables: string[], steps: {id, name, resolvedSendAt}[]})
  | 'PAST_DUE'                // per step: send time passed, needs send-now or skip
  | 'READY_TO_SEND'           // per step: emails prepared for manual sending (count)
  | 'FAILED_DELIVERIES'       // per step: failed emails (count)
  | 'NO_RECIPIENTS'           // per step: scheduled within 7 days but no team would receive it
  | 'NOT_ACTIVATED'           // per campaign: DRAFT with a step due within 7 days (or already past)
  | 'MISSING_REFERENCE_DATE'  // per campaign: relative steps but no reference date
  | 'DUE_SOON'                // per step, manual mode only: will need manual sending within 24 h
type AttentionItem = {
  id: string;                         // stable, e.g. "PAST_DUE:<stepId>"
  type: AttentionType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;                      // short English sentence, ready to display
  description: string;
  dueAt: string | null;               // relevant send time, if any
  campaign: {id, name} | null;        // null for announcements and global items
  step: {id, name, isAnnouncement: boolean} | null;
  count: number | null;               // READY_TO_SEND / FAILED_DELIVERIES
  details: Record<string, unknown>;
}
```
Items are sorted by severity (HIGH first), then by `dueAt` (earliest first, nulls last).

Severity rules:
- **HIGH:** SENDING_PAUSED, PAST_DUE and READY_TO_SEND. Also MISSING_VARIABLES in an ACTIVE campaign where an affected step is due within 48 h or already due.
- **MEDIUM:** other MISSING_VARIABLES in ACTIVE campaigns, FAILED_DELIVERIES, NO_RECIPIENTS and NOT_ACTIVATED. Also MISSING_VARIABLES in a DRAFT campaign with a step within 7 days.
- **LOW:** everything else, including DUE_SOON.

`POST /steps/:id/dismiss-failed` → `{ dismissed: number }` turns FAILED deliveries into SKIPPED (`skipReason: 'dismissed'`) so they leave the queue. If nothing else is pending, a FAILED step becomes SENT.

## Generic lists, tournaments & participation (v1.3)

### Generic list API (all list endpoints)
All list endpoints below use the same query format and response:

| Param | Meaning |
|---|---|
| `search` | Free text; matches the resource's search fields, case-insensitive |
| `filter[<key>]=a,b` | Multi-select filter. Several values = OR, several keys = AND. Repeating the param also works: `filter[status]=A&filter[status]=B`. Boolean filters use the values `true`/`false`. |
| `sort=<key>` / `sort=-<key>` | Sort ascending/descending; defaults per resource |
| `page`, `limit` | `page` ≥ 1 (default 1); `limit` 1–500 (default 25) |

An unknown filter or sort key returns 400, naming the allowed keys.

Response: `data: T[]` plus
```ts
meta: {
  total: number; page: number; limit: number; sort: string;
  filters: Record<string, string[]>;          // effective filters, including defaults
  facets: Facet[];                              // one per filter key, in display order
}
type Facet = {
  key: string; label: string;
  type: 'enum' | 'ref' | 'boolean' | 'tag';
  options: { value: string; label: string; count: number }[];
  // Counts apply search and all OTHER filters (standard faceting). Enum facets list every
  // option, even with count 0. Selected values are always listed.
}
```

| Resource | Endpoint | Search fields | Filters (`key`: type) | Sorts (default first) |
|---|---|---|---|---|
| Teams | `GET /teams` | name, contact, email, cc | `group`: ref · `archived`: boolean (**default `false`**) · `subscription`: enum SUBSCRIBED/UNSUBSCRIBED · `tournament`: ref | `name`, `contactName`, `email`, `createdAt`, `updatedAt` |
| Groups | `GET /groups` | name, description | — | `name`, `teamCount` |
| Templates | `GET /templates` | name, subject | `variable`: tag (campaign variables used) | `name`, `updatedAt` |
| Campaigns | `GET /campaigns` | name, description | `status`: enum · `tournament`: ref · `missingVariables`: boolean | `-createdAt`, `name`, `referenceDate`, `nextSendAt` |
| Announcements | `GET /announcements` | name, subject | `status`: enum · `createdBy`: ref | `-createdAt`, `name`, `resolvedSendAt` |
| Users | `GET /users` | name, email | `active`: boolean | `name`, `lastLoginAt`, `createdAt` |
| Deliveries | `GET /steps/:id/deliveries` | team name, email | `status`: enum · `sentManually`: boolean | `team`, `status`, `sentAt` |
| Tournaments | `GET /tournaments` | name, description, url | `ageGroup`: tag · `timing`: enum UPCOMING/ONGOING/PAST · `year`: enum | `startDate`, `-startDate`, `name`, `participantCount` |
| Participations | `GET /participations` | team, tournament, notes | `tournament`: ref · `team`: ref · `group`: ref (team's groups) · `ageGroup`: tag · `status`: enum · `overdue`: boolean · `timing`: enum (of the tournament) | `nextDueDate`, `tournament`, `team`, `status` |

This **replaces** the old ad-hoc list params: teams `groupId`/`includeArchived`, campaigns `status`, deliveries `status`. Pickers that need everything use `limit=500`. `/users/invitations` and `/templates/placeholders` stay plain arrays.

### Tournaments
```ts
type ParticipationStatus =
  | 'SIGNED_UP' | 'PAID' | 'ADDED_TO_SPORTSENGINE' | 'ADDED_TO_STAFF_CALENDAR'
  | 'ROSTER_CONFIRMED' | 'WAIVER_REQUESTED' | 'WAIVER_CONFIRMED' | 'PARTICIPATED'
  | 'WITHDRAWN';
type Milestone = {
  status: Exclude<ParticipationStatus, 'WITHDRAWN'>;
  label: string;                 // e.g. "Added to SportsEngine"
  offsetDays: number;            // relative to the anchor date; negative = before
  anchor: 'START' | 'END';       // tournament start or end date
  dueDate: string;               // YYYY-MM-DD, computed (only in tournament responses)
};
type Tournament = {
  id; name; url: string | null; description: string | null;
  startDate: string; endDate: string;            // YYYY-MM-DD, endDate >= startDate
  ageGroups: string[];                           // e.g. ["U10", "U12"], trimmed, unique
  timing: 'UPCOMING' | 'ONGOING' | 'PAST';       // vs today in the settings timezone
  milestones: Milestone[];                        // the 8 steps in process order
  participantCount: number;                       // participations that are not withdrawn
  statusCounts: Record<ParticipationStatus, number>;
  createdAt; updatedAt;
};
```
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /tournaments | generic list | `Tournament[]` |
| POST | /tournaments | `{name, url?, startDate, endDate, description?, ageGroups?, milestones?: {status, offsetDays, anchor}[]}` | `Tournament`. Milestones default to the participation defaults. |
| GET | /tournaments/:id | — | `Tournament` |
| PATCH | /tournaments/:id | same fields, all optional | `Tournament`. Linked campaigns follow date changes. |
| DELETE | /tournaments/:id | — | `null`. 409 if it has participations, unless `?force=true`, which also deletes them. |

**Milestone rule:** due dates must not decrease in process order. Otherwise 422, naming the offending steps.

### Participation process defaults
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /participation/statuses | — | `{status, label, order, terminal}[]` (process order; WITHDRAWN last) |
| GET | /participation/defaults | — | `{status, label, offsetDays, anchor}[]` |
| PUT | /participation/defaults | `{milestones: {status, offsetDays, anchor}[]}` (all 8) | same. Used for new tournaments only. |

Shipped defaults, in days relative to START unless noted: SIGNED_UP −90 · PAID −75 · ADDED_TO_SPORTSENGINE −60 · ADDED_TO_STAFF_CALENDAR −56 · ROSTER_CONFIRMED −30 · WAIVER_REQUESTED −21 · WAIVER_CONFIRMED −7 · PARTICIPATED END +1.

### Participations
```ts
type ParticipationStep = {
  status; label; dueDate: string;
  completedAt: string | null;                    // when this step was reached (from history)
  state: 'DONE' | 'NEXT' | 'OVERDUE' | 'UPCOMING' | 'WITHDRAWN';
};
type Participation = {
  id;
  tournament: { id, name, startDate, endDate, timing };
  team: { id, name, groups: {id, name}[] };
  ageGroup: string | null;                       // one of the tournament's ageGroups (required if it has any)
  status: ParticipationStatus;
  nextStatus: ParticipationStatus | null;        // null when PARTICIPATED or WITHDRAWN
  nextDueDate: string | null;
  overdue: boolean;                              // nextDueDate < today
  daysUntilDue: number | null;                   // negative when overdue
  steps: ParticipationStep[];                    // always all 8, for the Gantt chart
  notes: string | null;
  withdrawnAt: string | null;
  version: number; createdAt; updatedAt;
};
type StatusChange = { id; fromStatus: ParticipationStatus | null; toStatus: ParticipationStatus; note: string | null; changedBy: {id, firstName, lastName} | null; changedAt };
```
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /participations | generic list | `Participation[]` |
| POST | /participations | `{tournamentId, teamId, ageGroup?, notes?}` | `Participation`, status SIGNED_UP. 409 if the team is already in that tournament. |
| POST | /participations/bulk | `{tournamentId, teamIds, ageGroup?}` | `{created: Participation[], skipped: {teamId, reason}[]}` |
| GET | /participations/:id | — | `Participation & { history: StatusChange[] }` |
| PATCH | /participations/:id | `{version, ageGroup?, notes?}` | `Participation` |
| DELETE | /participations/:id | — | `null` |
| POST | /participations/:id/transition | `{to, version, note?}` | `Participation` |
| POST | /participations/transition | `{ids, to, note?}` | `{results: {id, ok: boolean, error?: string, participation?: Participation}[]}` (bulk; no version check) |

**State machine:**
- **Forward:** from any non-terminal status to any later status. Skipped steps are recorded as completed at the same moment.
- **Back:** exactly one step (undo), except from PARTICIPATED.
- **Withdraw:** WITHDRAWN from any non-terminal status.
- **Reinstate:** from WITHDRAWN back to the status held before withdrawing.
- **Terminal:** PARTICIPATED and WITHDRAWN.

Invalid transitions return 409 with `details: {allowed: ParticipationStatus[]}`. A version mismatch returns 409.

### Campaign ↔ tournament
- `Campaign` gets `tournament: {id, name, startDate, endDate} | null` and `audienceFromTournament: boolean`.
- Create and PATCH accept `tournamentId` (null unlinks) and `audienceFromTournament`.
- While linked, `referenceDate` is the tournament start date at 00:00 in the campaign timezone, and it follows tournament date changes. PATCHing `referenceDate` while linked returns 422.
- If `audienceFromTournament` is true, the recipients also include every team with a non-withdrawn participation in that tournament, on top of the audience groups. Then no audience group is required.

### Work queue additions
- `AttentionItem` gets `tournament: {id, name} | null`.
- New types, grouped **per tournament and step**:
  - **`PARTICIPATION_OVERDUE`:** severity HIGH if the tournament starts within 14 days, otherwise MEDIUM.
  - **`PARTICIPATION_DUE_SOON`:** the next step is due within 3 days. Severity LOW.
- `count` is the number of teams. `details = {status, label, dueDate, participations: {id, teamId, teamName}[]}`.

## Announcements removed (v1.4)

Announcements (one-off sends without a campaign) are removed completely. **All communication is planned as campaign steps.**

- **Removed endpoints:** `GET /announcements`, `POST /announcements`, `POST /announcements/recipients-preview`.
- **Step type changes:**
  - `campaignId` is always set (non-null).
  - `bodyHtmlOverride` and `audienceTeams` are removed; steps always use their template.
- **`AttentionItem.step`** is now `{id, name}`: `isAnnouncement` is removed, and every step-level item has `campaign` set.
- **Data:** existing announcements were deleted together with their delivery log. The migrations have since been consolidated into one `InitialSchema`.
- **Everything else still applies to campaign steps:** manual sending, the work queue, deliveries and the quota. Earlier sections that mention announcements are superseded by this one.

## Campaigns replaced by participation emails (v2.0)

Campaigns are removed completely. **All planned emails now belong to a participation** (one team at one tournament). This section supersedes everything above about campaigns, campaign variables, campaign steps and step audiences.

### Model
- **Tournament email plan:** `Tournament.emailPlan: EmailPlanItem[]`. It is copied into a participation's email steps when the participation is created. Changing the plan affects only new participations, unless it is applied explicitly (see below).
- **Participation email steps:** `EmailStep`, one email to that team (the team's email + CC).
  - They are scheduled automatically. There is no draft/activate anymore.
  - They are not sent while the participation is WITHDRAWN.
  - Steps already past their send time when created are flagged past-due (send-now or skip).
- **Timing:**
  - `ABSOLUTE` (`sendAt`), or `RELATIVE`: `offsetDays` + `timeOfDay` from the tournament START or END date (`anchor`), in the settings timezone.
  - Tournament date changes move unsent relative steps.
- **Variables:**
  - `Tournament.variables` holds values for all teams.
  - `Participation.variables` holds per-team overrides; a blank value means no override.
  - Effective value = the override, otherwise the tournament value. A blank effective value is missing.
  - Missing variables block sending, copying and marking as sent, exactly like before (422 with `details.missingVariables`).
- **Placeholders** (replacing `campaign.*`):
  - `{{tournament.name}}`, `{{tournament.startDate}}`, `{{tournament.endDate}}` (formatted), `{{tournament.url}}`
  - `{{tournament.vars.<key>}}`, `{{participation.ageGroup}}`
  - `{{team.name}}`, `{{team.contactName}}`, `{{organizer.name}}`, `{{unsubscribeUrl}}`
  - At the time, the migration rewrote existing templates (migrations are now consolidated into `InitialSchema`): `campaign.vars.` → `tournament.vars.`, `campaign.name` → `tournament.name`, `campaign.referenceDate` → `tournament.startDate`.
- **Unchanged:** sending modes (automatic/manual), manual walk-through, delivery log, quota, retries, unsubscribe.

```ts
type EmailTiming = { timingType: 'ABSOLUTE' | 'RELATIVE'; sendAt: string | null; offsetDays: number | null; timeOfDay: string | null; anchor: 'START' | 'END' };
type EmailPlanItem = EmailTiming & { id: string; name: string; templateId: string; templateName: string | null; subjectOverride: string | null };
type EmailStep = EmailTiming & {
  id; participationId; planItemId: string | null; name; templateId: string | null; templateName: string | null; subjectOverride: string | null;
  resolvedSendAt: string | null; status: 'SCHEDULED' | 'PAUSED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  isPastDue: boolean; missingVariables: string[];
  delivery: { id, status: DeliveryStatus, sentManually: boolean, sentAt: string | null, lastError: string | null } | null;
  sentAt: string | null; version: number; createdBy; updatedBy; createdAt; updatedAt;
};
type RequiredVariable = { key: string; value: string | null; source: 'PARTICIPATION' | 'TOURNAMENT' | null; steps: {id, name}[] };
// Tournament gets:
//   variables: Record<string,string>; emailPlan: EmailPlanItem[];
//   requiredVariables: {key, hasValue, missingFor: number, usedBy: string[]}[]; missingVariables: string[]
//   (keys missing for at least one non-withdrawn participation)
// Participation gets:
//   variables: Record<string,string> (overrides); requiredVariables: RequiredVariable[]; missingVariables: string[];
//   emails: { total, scheduled, sent, failed, ready, blocked, nextSendAt: string | null }
// Delivery (list endpoint below) gets: step: {id, name}, tournament: {id, name}, participationId
```

### Endpoints
| Method | Path | Body | Returns |
|---|---|---|---|
| POST / PATCH | /tournaments(/:id) | also `variables`, `emailPlan: (EmailTiming & {id?, name, templateId, subjectOverride?})[]` | `Tournament`. Plan items get an `id` when new. |
| POST | /tournaments/:id/email-plan/apply | — | `{added: number}`. Adds plan items that non-withdrawn participations don't have yet (matched by `planItemId`). |
| PATCH | /participations/:id | also `variables` (overrides) | `Participation` |
| GET | /participations/:id/steps | — | `EmailStep[]` sorted by `resolvedSendAt` |
| POST | /participations/:id/steps | `EmailTiming & {name, templateId, subjectOverride?}` | `EmailStep` |
| PATCH | /steps/:id | same fields, all optional, plus `version` | `EmailStep` (409 on version/status change) |
| DELETE | /steps/:id | — | `null` (PAUSED/CANCELLED only) |
| POST | /steps/:id/pause · resume · cancel · send-now · skip | — | `EmailStep` (send-now: 422 on missing variables) |
| POST | /steps/bulk | `{ids, action: 'send-now'\|'skip'\|'pause'\|'resume'\|'cancel'}` | `{results: {id, ok, error?}[]}` |
| GET | /steps/:id/deliveries | generic list | `Delivery[]` (unchanged) |
| GET | /deliveries | generic list. Search: team, email, step. Filters: `status` enum, `tournament` ref, `team` ref, `step` tag (step name), `sentManually` boolean. Sorts: `-createdAt`, `sentAt`, `team`, `tournament` | `Delivery[]`. Drives the manual walk-through across teams, e.g. `?filter[status]=READY&filter[tournament]=…` |
| POST | /deliveries/bulk | `{ids, action: 'dismiss'\|'resend'}` | `{results: {id, ok, error?}[]}` (dismiss: FAILED → SKIPPED `dismissed`) |
| POST | /templates/preview · /templates/test-send | `{subject, bodyHtml, teamId?, tournamentId?, participationId?}` | as before, plus `missingVariables` when a tournament or participation is given |

**Removed:**
- all `/campaigns…` endpoints
- `/steps/:id/recipients`
- `/steps/:id/resend-failed` and `/steps/:id/dismiss-failed` (use `/deliveries/bulk`)
- `Campaign` everywhere: `Delivery`, `AttentionItem.campaign`, and the teams filter `tournament` stays

**Participation list additions** (generic list): filters `missingVariables` (boolean), `emailsReady` (boolean: has READY deliveries), `emailsFailed` (boolean).

### Work queue (replaces the campaign-based items)
Aggregated per tournament so large tournaments don't flood the queue. `campaign` is removed from `AttentionItem`; `tournament` is set.

| Type | Scope | Severity | details |
|---|---|---|---|
| SENDING_PAUSED | global | HIGH | `{pausedUntil, reason}` |
| MISSING_VARIABLES | tournament | HIGH if an affected email is due within 48 h, else MEDIUM | `{missingVariables, participations: {id, teamName, missing: string[]}[]}` |
| PAST_DUE | tournament + step name | HIGH | `{stepName, stepIds: string[], teams: string[]}` |
| READY_TO_SEND | tournament | HIGH | `{count}` → walk-through over `/deliveries?filter[status]=READY&filter[tournament]=<id>` |
| FAILED_DELIVERIES | tournament | MEDIUM | `{deliveryIds, teams}` |
| DUE_SOON | tournament + step name (manual mode only, next 24 h) | LOW | `{stepName, stepIds, teams}` |
| PARTICIPATION_OVERDUE / PARTICIPATION_DUE_SOON | unchanged | | |

## Team graduation year and age group (v2.1)

- `Team` gains `graduationYear: number | null` (2000–2100, writable on POST/PATCH `/teams`) and read-only `ageGroup: string | null`, calculated for today: school grade + 6, e.g. the class of 2031 is `U14` in school year 2026/27.
- `GET /teams` adds filters `ageGroup` and `graduationYear` (tags) and sorts `graduationYear` and `ageGroup` (youngest first).
- CSV import/export gains a `graduationYear` column. An empty cell keeps the current value on upsert.
- Settings gain `seasonStartMonth` (1–12, default 9): from the 1st of that month teams move up a grade and age group.
- `Participation.team` gains `graduationYear` and `ageGroup` (calculated for the tournament's start date).
- `POST /participations` and `PATCH /participations/:id`: when `ageGroup` is omitted or empty, the tournament age group matching the team's graduation year is used. That's a division named exactly after the year, else the youngest `U<n>`/`<n>U` group with n ≥ the team's age. If nothing matches, it's still 422.
- `POST /participations/bulk`: an `ageGroup` applies to all teams. Without one, each team gets its calculated group, and teams without a match are reported in `skipped` with the reason "No age group fits its graduation year: choose one".

## Participation days (v2.2)

- `Participation` gains `days: string[]`: the tournament days (YYYY-MM-DD) the team plays on. It is sorted, has no duplicates and holds at least one day.
- `POST /participations`, `POST /participations/bulk` and `PATCH /participations/:id` accept `days`.
  - If `days` is omitted on create, the team gets all tournament days. In bulk, the chosen days apply to every team.
  - An empty list returns 422 "Choose at least one day". A day outside the tournament returns 422. A malformed date returns 400.
- `GET /participations` adds the filter `day` (tag, labelled like "Fri, Jun 11, 2027").
- Changing a tournament's dates moves each participation's days along, keeping their position (1st, 2nd … day). Days past the new end are dropped, and if none remain the team gets all days.
- New placeholder `{{participation.days}}`: the days, formatted like the tournament dates and separated by commas.
- A tournament may last at most 60 days (422 otherwise).
- Migration `ParticipationDays` backfills existing participations with all days of their tournament.
