# Team Communication Planner — Requirements (v4)

> Status: **Draft for review** (v4: campaigns replaced by participation emails; tournaments are the central concept). Replaces the tournament-management scope of [requirements.md](requirements.md).
> Priorities: **M** = must (MVP), **S** = should, **C** = could.

---

## 1. Purpose

A small self-hosted web app that lets an organizer and their co-organizers plan and send emails to **teams**. Each team is reached through its captain/contact person.

It covers two things (plus tournament tracking, §4.5d):

1. **Reusable email templates** with placeholders (team name, contact name, dates, …).
2. **Planned emails per participation:** each team at a tournament gets its own email timeline (copied from the tournament's email plan), e.g. *welcome → waiver request → logistics → thank-you*, sent relative to the tournament dates.

### 1.1 Explicitly out of scope
- Tournaments, matches, brackets, scores, standings. If needed, these live in other tools.
- Multiple organizations / multi-tenancy
- Tracking replies or confirmations. Replies simply land in the organizer's normal mailbox via Reply-To.
- SMS, WhatsApp, Discord and other channels
- Newsletter/marketing features: open/click tracking, A/B tests
- File attachments
- Exceptions to unsubscribe: an unsubscribed team receives **nothing**, not even essential messages such as cancellations

---

## 2. Users

| Role | Who | Can |
|---|---|---|
| `ADMIN` | The organizer and co-organizers (all equal) | Everything |

| ID | Requirement | P |
|---|---|:-:|
| USR-1 | No public sign-up. The first admin is created from environment variables on first start. | M |
| USR-2 | Any admin can invite a co-organizer by email. The single-use invitation link expires after 72 h, and the invitee sets their own password. Pending invitations can be revoked or resent. | M |
| USR-3 | Admins can deactivate other admins. Deactivating ends the user's sessions immediately. You cannot deactivate yourself or the last active admin. | M |
| USR-4 | Password reset by emailed single-use link (TTL 1 h). | M |
| USR-5 | Email steps record who created them and who last changed them. The delivery log shows who triggered a send ("sent by"). | S |
| USR-6 | Two admins editing the same step at the same time: the second save gets a conflict message instead of silently overwriting (optimistic locking). | S |

- Teams never log in. They only receive emails. (M)

---

## 3. Core Journeys

**J1 — Maintain teams (M).** Add, edit, archive and import teams (name, contact name, email, optional CC addresses). Teams are reached through their tournament participations.

**J2 — Write templates (M).** Create a template with subject and body, insert placeholders, preview it with a sample team, and send a test to yourself.

**J3 — Plan a tournament's emails (M).** On the tournament, set variable values (venue, kick-off, …) and the email plan: each item has a template and a send time relative to the start or end date (e.g. "21 days before start at 09:00"). When a team signs up, the plan is copied to its participation.

**J4 — Adjust per team (M).** On a participation, override variable values, add or edit emails for that team only, pause, skip or send now. When the tournament dates move, all unsent relative emails move with them. "Apply plan" adds new plan items to teams that are already signed up.

**J6 — Check what went out (M).** See each sent step with its recipients, per-recipient status (sent / failed / skipped) and error messages. Failed recipients can be resent.

---

## 4. Functional Requirements

### 4.1 Teams
| ID | Requirement | P |
|---|---|:-:|
| TEAM-1 | A team has a name (unique), contact name, primary email, optional CC emails (max 5) and optional notes. | M |
| TEAM-2 | Teams can be archived. Archived teams receive nothing and are hidden by default, but still appear in delivery history. | M |
| TEAM-3 | *(Removed: team groups. Teams are organized by tournament participation and age group.)* | — |
| TEAM-4 | CSV import (name, contact name, email, cc, graduation year) with a preview, per-row validation errors, and an update-or-create choice for existing team names. CSV export. | S |
| TEAM-5 | Email addresses are validated on save. A team marked `unsubscribed` (§4.5) is shown with a badge. | M |
| TEAM-6 | A team has an optional graduation year (class of). Its age group is calculated as school grade + 6 (8th grade → U14) and rolls over on the 1st of a configurable month (default September). Sign-up defaults the participation's age group to the tournament group matching the team: a division named after the graduation year, else the youngest `U<n>`/`<n>U` group with n ≥ the team's age at the tournament start. | S |

### 4.2 Email Templates
| ID | Requirement | P |
|---|---|:-:|
| TPL-1 | A template has a name, subject and body (rich-text editor producing sanitized HTML). A plain-text version is generated automatically. | M |
| TPL-2 | Placeholders use `{{…}}` syntax: `team.name`, `team.contactName`, `tournament.name`, `tournament.startDate`/`endDate` (formatted), `tournament.url`, `participation.ageGroup`, `tournament.vars.<key>` (tournament variables, overridable per team), `organizer.name`, `unsubscribeUrl`. | M |
| TPL-3 | Unknown placeholders are rejected on save (422, naming the placeholder). `tournament.vars.*` values are checked when an email is sent or copied (VAR-3). | M |
| TPL-4 | Placeholder values are HTML-escaped. Body HTML is sanitized with an allow-list: no scripts, no event handlers, no `javascript:` links. | M |
| TPL-5 | Live preview rendered for a chosen team, plus a "send test to me" action. | M |
| TPL-6 | Duplicate a template. | S |
| TPL-7 | Editing a template affects only steps not yet sent. Sent emails keep a snapshot of what was actually sent. | M |
| TPL-8 | A shared layout (logo, footer text, unsubscribe link) wraps every email and is configured once in the settings. | S |

### 4.3 Participation emails (replaces campaigns)
| ID | Requirement | P |
|---|---|:-:|
| PE-1 | A tournament has an **email plan**: items with name, template, optional subject override and timing (`ABSOLUTE` send time, or `RELATIVE` offset days + time of day from the tournament START or END date, in the organizer timezone). | M |
| PE-2 | Creating a participation copies the plan into its **email steps** (one email to that team + CC). Steps are scheduled immediately; ones already past their time are flagged past-due (send now or skip). | M |
| PE-3 | Per participation, steps can be added, edited (optimistic locking), paused, resumed, cancelled, deleted (paused/cancelled only), sent now or skipped; bulk actions for many steps. | M |
| PE-4 | Tournament date changes move all unsent relative steps. "Apply plan" adds plan items missing on existing participations (no duplicates). | M |
| PE-5 | Emails of withdrawn participations are not sent. Deleting a team deletes its participations and their emails. | M |
| PE-6 | Campaigns (and their data) are removed; existing templates are migrated to tournament placeholders. | M |

### 4.4 Announcements (removed)
One-off announcements were removed. Every email is a participation email step (§4.3).

### 4.5 Sending & Delivery Log
| ID | Requirement | P |
|---|---|:-:|
| DLV-1 | When a step is due, the system creates one delivery row per recipient team, renders the email, and sends it via SMTP. The To address is the team's primary email; CC addresses go in CC. | M |
| DLV-2 | No double sends: deliveries are unique per (step, team). A worker restart or retry never sends the same step to the same team twice. | M |
| DLV-3 | Transient SMTP errors are retried with backoff (1 min, 5 min, 30 min), then marked `FAILED` with the error message. | M |
| DLV-4 | Each delivery stores the rendered subject/body snapshot, the recipient addresses, status (`QUEUED`, `SENT`, `FAILED`, `SKIPPED`), `sentAt` and the error. | M |
| DLV-5 | "Resend" for failed deliveries (single or all in a step). | M |
| DLV-6 | Every email carries an **unsubscribe link** plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers (one-click, RFC 8058). Unsubscribing marks the team `unsubscribed`, and it is `SKIPPED` from then on. The organizer can re-subscribe a team only if the team asks. | M |
| DLV-7 | Emails are sent **from the organizer's existing Google Workspace mailbox** via `smtp.gmail.com` (port 465 SSL, or 587 STARTTLS), so the From address is that mailbox and replies land in it automatically. An optional Reply-To (e.g. a shared address) can be set in the settings. | M |
| DLV-8 | Throttling protects the mailbox from Google's sending limits (§6.1). Exceeding them can suspend sending for up to 24 h, **including the organizer's normal email**. The app enforces a per-minute rate (default 20/min) and a cap on recipients in a **rolling 24 h window** (default 1,000; To and CC both count), counted from the delivery log. Sends beyond the cap wait until quota frees up, and the timeline warns in advance when a step's recipient count exceeds the remaining quota. | M |
| DLV-9 | Authentication: **OAuth2 (XOAUTH2)** by default, using an OAuth client of type *Internal* in the organization's Google Cloud project (no Google app review needed) with a refresh token for the scope `https://mail.google.com/`. Fallback: a 16-character **app password**, which requires 2-Step Verification on the account and app passwords being allowed by the Workspace admin. Passwords without 2-Step Verification ("less secure apps") no longer work. | M |
| DLV-10 | No extra work is needed for the *Sent* folder: Gmail saves messages sent via `smtp.gmail.com` there automatically, so co-organizers with mailbox access see everything that went out. | — |
| DLV-11 | One message per team (To + up to 5 CC). This stays well below Gmail's limit of 100 recipients per SMTP message. Teams are never batched into one email or BCC. | M |
| DLV-12 | If the SMTP server rejects mail with a quota error (`550 5.4.5` / "Daily user sending limit exceeded"), the app stops sending and pauses all queued deliveries until the next day. The failure is shown prominently, and nothing is retried in a tight loop. | M |

### 4.5a Manual sending
Sending through the mailbox is optional. In manual mode the app only prepares each email; the organizer sends it from their own mail program.

| ID | Requirement | P |
|---|---|:-:|
| MAN-1 | A global **sending mode** in the settings: `AUTOMATIC` (send via Gmail) or `MANUAL`. Without a configured mailbox (`MAIL_AUTH_MODE=NONE`) the mode is always `MANUAL`. | M |
| MAN-2 | In manual mode a due step (or send-now) creates one delivery per team with status `READY` instead of sending. Unsubscribed and archived teams are skipped as usual. | M |
| MAN-3 | For each ready delivery the organizer can view and copy the recipients (To/CC), the subject and the body. The body is copied as rich text plus plain text, and includes the footer and the team's unsubscribe link. The organizer can also open the message in the mail app via a `mailto:` link, with the body shortened if it is very long. | M |
| MAN-4 | "Mark as sent" per delivery, "Mark as sent & next" to walk through all teams, and "Mark all as sent" per step. Marking stores a snapshot of the message, the time, and who marked it. | M |
| MAN-5 | "Undo" turns a manually marked delivery back into `READY` and reopens the step. | S |
| MAN-6 | A step is `SENT` once no delivery is `QUEUED` or `READY`. Failed automatic deliveries can also be sent manually and marked. | M |
| MAN-7 | Switching to manual turns queued deliveries into `READY`. Resending a failed delivery in manual mode makes it `READY`. Manually sent emails do not count toward the sending quota. | M |
| MAN-8 | The dashboard lists all steps with emails waiting to be sent manually. | M |
| MAN-9 | Invitations always return a copyable invite link, so co-organizers can be invited without a mailbox. Password reset by email is unavailable without a mailbox. | M |

### 4.5b Template-driven variables
| ID | Requirement | P |
|---|---|:-:|
| VAR-1 | Variables are set on the tournament and can be overridden per participation (a blank override falls back). Pages show which variables the unsent emails need, their effective value and source, and for how many teams each is missing. | M |
| VAR-2 | Saving tournaments, participations, emails and templates is never blocked by missing variables. A blank value counts as missing. | M |
| VAR-3 | An email whose variables are not all provided cannot be sent automatically, copied, or marked as sent. A due step waits (and becomes past-due after 1 h). Queued emails are held and checked again every 5 minutes. Send-now, copy and mark-sent return 422 listing the missing variables. | M |
| VAR-4 | The template preview for a tournament or participation lists its missing variables. | S |

### 4.5c Work queue
| ID | Requirement | P |
|---|---|:-:|
| WQ-1 | A work queue (with a count in the navigation and a top-5 dashboard card) lists everything that needs attention, aggregated per tournament: paused sending, missing variables, past-due emails, emails ready to send manually, failed emails, emails due within 24 h (manual mode), and overdue/soon-due participation steps. | M |
| WQ-2 | Each item offers the fitting action: open the tournament's variables, bulk send-now or skip, start the manual walk-through over the tournament's ready emails, resend or dismiss failed emails, advance participations, resume sending. | M |
| WQ-3 | Dismissing failed emails marks them skipped ("dismissed") so they leave the queue. | S |

### 4.5d Tournaments & participation
| ID | Requirement | P |
|---|---|:-:|
| TRN-1 | A tournament has a name, optional URL, start and end date (calendar dates), optional description and a list of age groups. | M |
| TRN-2 | A participation records that a team goes to a tournament (once per tournament), with an age group from the tournament's list (required if it has any) and notes. | M |
| TRN-3 | Participation process: Signed up → Paid → Added to SportsEngine → Added to staff calendar → Roster confirmed with families → Waiver request sent → Waiver submission confirmed → Participated (end state). "Withdrawn" is a side exit. Allowed: any later step (skipped steps are recorded), one step back (undo), withdraw, and reinstate to the status before withdrawing. Every change is kept in a history with who made it and when. | M |
| TRN-4 | Each tournament has a timeline: for each step, a number of days relative to the start (or end) date, taken from editable defaults. Due dates must follow the process order. A participation is overdue when its next step is past its due date. | M |
| TRN-5 | A Gantt chart shows, for all (filtered) participations, the step due dates, completion dates and tournament dates, with a "today" line. | M |
| TRN-6 | Overdue and soon-due steps appear in the work queue, grouped per tournament and step, with a bulk "advance" action. | M |
| TRN-7 | A team can be signed up for a tournament from the team's page and from the participations list (tournament, team(s), age group, days). | M |
| TRN-8 | A participation has one or more tournament days the team plays on (default: all days), editable later and filterable. When the tournament dates change, each day keeps its position (1st, 2nd … day). Days beyond the new end are dropped, and if none remain the team gets all days. Templates can use `{{participation.days}}`. A tournament lasts at most 60 days. | M |
| TRN-8 | Sync with SportsEngine is analysed in docs/sportsengine-integration.md and not yet built. | C |

### 4.5e Lists
| ID | Requirement | P |
|---|---|:-:|
| LST-1 | Every entity list (teams, templates, users, deliveries, tournaments, participations) uses one generic list API and one table component: search, multi-select filters with counts (OR within a filter, AND across filters), sorting and paging, with the state kept in the URL. | M |

### 4.6 Settings
| ID | Requirement | P |
|---|---|:-:|
| SET-1 | Organizer name, sender display name, optional Reply-To address, default timezone, footer text/logo (TPL-8), rate limit and daily cap (DLV-8). | M |
| SET-2 | Mailbox address plus either OAuth2 client ID/secret/refresh token or an app password come from environment variables only. They are never stored in the DB or shown in the UI. A "send test email" button checks the configuration. | M |

---

## 5. Data Model

All tables have a UUID PK and `created_at`/`updated_at` (`timestamptz`). Columns are snake_case, TypeORM properties camelCase.

```
Team *─* TeamGroup
Tournament 1─* Participation *─1 Team
Participation 1─* EmailStep (communication_steps) *─1 EmailTemplate
EmailStep 1─* EmailDelivery *─1 Team
Participation 1─* ParticipationStatusChange
User 1─* Invitation                     (admins only)
Setting                                 (single row)
```

| Entity | Table | Fields |
|---|---|---|
| **User** | `users` | `email` (unique), `passwordHash`, `firstName`, `lastName`, `isActive`, `lastLoginAt?` |
| **Invitation** | `invitations` | `email`, `tokenHash` (unique), `invitedBy` (User), `expiresAt`, `acceptedAt?`, `revokedAt?` |
| **Team** | `teams` | `name` (unique), `contactName`, `email`, `ccEmails` (text[]), `notes?`, `isArchived`, `unsubscribedAt?`, `unsubscribeToken` (unique, random), `graduationYear?` |
| **EmailTemplate** | `email_templates` | `name` (unique), `subject`, `bodyHtml`, `bodyText` |
| **Tournament** | `tournaments` | `name`, `url?`, `startDate`, `endDate`, `description?`, `ageGroups`, `milestones` (jsonb), `variables` (jsonb), `emailPlan` (jsonb) |
| **Participation** | `participations` | `tournament`, `team`, `ageGroup?`, `status`, `notes?`, `variables` (jsonb overrides), `withdrawnAt?`, `version` |
| **EmailStep** | `communication_steps` | `participation` (CASCADE), `planItemId?`, `anchor` (START/END), `name`, `template`, `subjectOverride?`, `timingType` (`ABSOLUTE`\|`RELATIVE`), `sendAt?`, `offsetDays?`, `timeOfDay?` (`HH:mm`), `resolvedSendAt?` (computed, indexed), `status`, `audienceGroups?` (M:N), `sentAt?`, `createdBy`, `updatedBy`, `version` |
| **EmailDelivery** | `email_deliveries` | `step` (CASCADE), `team`, `toEmail`, `ccEmails`, `renderedSubject`, `renderedBodyHtml`, `status`, `attempts`, `lastError?`, `sentAt?`, `providerMessageId?`, `triggeredBy?` (User; null = scheduler); unique (`step_id`, `team_id`) |
| **Setting** | `settings` | `organizerName`, `senderName`, `replyToEmail?`, `timezone`, `footerHtml?`, `logoUrl?`, `ratePerMinute`, `dailyRecipientCap` |

DB constraints:
- `RELATIVE` ⇒ `offset_days` and `time_of_day` are not null.
- `ABSOLUTE` ⇒ `send_at` is not null.
- A step needs a template or a body override.

### 5.1 Impact on existing code
The entities generated earlier under `backend/src/modules/` belong to the dropped scope:
- `Tournament` and `Match` are **obsolete** and should be deleted.
- `User` loses `role`, `organizationId` and `teamsCaptained`.
- `Team` becomes the contact record above. The captain is a name and email, no longer a User.

---

## 6. Non-Functional Requirements

**Security (M)**
- Login with email and password (argon2id, min 12 characters), a JWT session in an httpOnly cookie, and CSRF protection.
- Login rate limit (5/min).
- DTO validation (`class-validator`, whitelist).
- Helmet, CORS restricted to the frontend origin.
- Secrets in env only, validated at startup.

**Privacy / GDPR (M)**
- The app stores contact names and emails of team representatives.
- Every email includes a working unsubscribe (DLV-6).
- Delivery snapshots are purged after 12 months (configurable).
- Deleting a team anonymizes its past deliveries (email and name replaced).
- Data stays on the self-hosted server.
- A privacy notice is linked in the email footer.

**Deliverability (M)**
- The From address is always the authenticated mailbox address. It is never overridden, so the provider's SPF/DKIM stays valid and no DNS setup is needed.
- Every email has both HTML and plain-text parts.
- **Workspace prerequisites** (one-time, by the Workspace admin): DKIM signing enabled in the Admin console (it is **off by default**); SPF record includes `_spf.google.com`; a DMARC record exists. The settings page links to a checklist.
- If volume ever outgrows the Workspace limits, switching to a sending service is a configuration change only (same SMTP interface).

### 6.1 Google Workspace sending limits (reference)
| Limit | Value |
|---|---|
| Messages per user per day | 2,000 (500 for trial accounts) |
| Total recipients per day | 10,000 |
| External recipients per day | 3,000, of which 2,000 unique |
| Recipients per message via SMTP | 100 (To + CC + BCC) |
| Window | Rolling 24 h, not midnight |
| When exceeded | Sending blocked for up to 24 h |

The app's default cap (1,000 recipients / 24 h) leaves room for the organizer's normal email, which counts against the same quota.

**Reliability (M)**
- Scheduled sends survive restarts: the schedule lives in PostgreSQL, not in memory.
- A missed send window (e.g. the server was down) is caught up on start if it is less than 1 h late; otherwise it is flagged for the organizer (same as CMP-5).
- Daily DB backup.
- `/health` endpoint for Coolify.

**Usability (S)**
- German and English UI, with dates in the configured timezone.
- Works on mobile for checking status and the work queue.

**Quality (M)**
- Unit tests for send-time calculation (offsets, DST changes, reference-date moves), placeholder rendering/escaping, and recipient resolution.
- Integration tests for the scheduler against real Postgres (no double send under concurrency or restart).
- E2E for J3 and J5.
- ≥ 80 % coverage.

---

## 7. Architecture

| Concern | Decision |
|---|---|
| Frontend | Next.js + Tailwind CSS v4 (as in requirements.md §4) |
| Backend | NestJS 11 modules: `auth`, `user`, `team`, `template`, `tournament` (tournaments, participations), `email` (participation email steps), `attention` (work queue), `delivery` (scheduler + sender), `settings`, `health` |
| DB | PostgreSQL + TypeORM, migrations only (`synchronize: false`) |
| Scheduler | `@nestjs/schedule` cron every minute. It claims due steps and deliveries with `SELECT … FOR UPDATE SKIP LOCKED`, so no Redis or queue system is needed at this volume. |
| Email | Nodemailer against `smtp.gmail.com` (XOAUTH2 with automatic token refresh, or app password), Handlebars for placeholders, `sanitize-html` |
| Deployment | Coolify: `web`, `api`, `postgres`. Migrations run as a pre-deploy command, using `npm ci --omit=dev` in the image. |

---

## 8. Milestones

1. **Foundation:** auth, invitations and admin management, settings, teams (incl. CSV import), migrations, Coolify deploy.
2. **Templates:** editor, placeholders, preview, test send.
3. **Sending:** delivery engine, delivery log, unsubscribe.
4. **Tournaments:** participation process, email plans, per-team emails and variables, Gantt chart, work queue.

---

## 9. Acceptance Criteria Examples

- **Given** a tournament starting 20 June with a plan item "−14 days at 09:00", **when** a team signs up, **then** its email is scheduled for 6 June 09:00 (organizer timezone). **When** the tournament moves to 27 June, **then** the email moves to 13 June 09:00.
- **Given** a step sent to 12 teams where 1 SMTP call fails permanently, **then** 11 deliveries are `SENT`, 1 is `FAILED` with the error, the step shows `FAILED (1)`, and "Resend" sends only to that one team.
- **Given** the worker crashes mid-send and restarts, **then** no team receives the step twice.
- **Given** a team clicked unsubscribe, **then** it is skipped by all later steps, and the delivery log shows `SKIPPED (unsubscribed)`.
- **Given** the cap is 1,000 and 980 recipients were sent in the last 24 h, **when** a step for 50 teams becomes due, **then** 20 are sent now, the other 30 are sent as quota frees up, and the timeline showed a warning beforehand.
- **Given** Gmail answers with a daily-limit error, **then** sending pauses, queued deliveries are not retried until the next day, and the dashboard shows the reason.
- **Given** admin A invites B, **when** B opens the link after 72 h, **then** it is rejected and A can resend the invitation.
- **Given** a template using `{{tournament.vars.venue}}` for a team whose tournament has no `venue` value (and no override), **when** the step is due, **then** nothing is sent, the step waits, and the work queue lists the tournament with the missing variable and the affected teams.

---

## 10. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Should unsubscribed teams still get essential messages? | **No.** Unsubscribe blocks all emails. |
| 2 | Which sender? | **The existing Google Workspace mailbox** via `smtp.gmail.com` (DLV-7 to DLV-12, §6.1). |
| 3 | Co-organizers? | **Yes**, invitable from the start (USR-1 to USR-6). |
| 4 | Attachments? | **No**, out of scope. |

All open questions are resolved.

Sources for §6.1 and DLV-9: [Google – Gmail sending limits in Google Workspace](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace), [Smartlead – Gmail & Workspace limits](https://www.smartlead.ai/blog/gmail-sending-limits), [serversmtp.com – Gmail SMTP auth changes](https://serversmtp.com/limits-of-gmail-smtp-server/).
