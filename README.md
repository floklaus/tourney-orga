# Team Communication Planner

A small self-hosted web app for planning and sending emails to sports teams from your own Google Workspace mailbox. It covers reusable templates with placeholders, tournaments with a participation process per team, planned emails per team relative to the tournament dates, a work queue, and a delivery log.

- **Requirements:** [requirements-detailed.md](requirements-detailed.md)
- **REST API:** [docs/api-contract.md](docs/api-contract.md)

| Part | Stack |
|---|---|
| `backend/` | NestJS 11, TypeORM 0.3, PostgreSQL 16, Nodemailer (Gmail SMTP) |
| `frontend/` | Next.js 16 (App Router), React 19, Tailwind CSS v4 |

The scheduler runs inside the API process. Every minute it claims due steps and deliveries from PostgreSQL (`FOR UPDATE SKIP LOCKED`, plus an advisory lock across instances), so there is no Redis or queue to run.

## Local development

```bash
# 1. PostgreSQL + Mailpit (catches all outgoing mail at http://localhost:8025)
docker run -d --name tourney-orga-pg -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app -p 5544:5432 postgres:16-alpine
docker run -d --name tourney-orga-mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit

# 2. API on :3001
cd backend
cp ../.env.example .env      # then set: DATABASE_URL=postgres://app:app@localhost:5544/app,
                             # MAIL_AUTH_MODE=SMTP, SMTP_HOST=localhost, SMTP_PORT=1025,
                             # APP_URL=http://localhost:3000, API_PUBLIC_URL=http://localhost:3001
npm ci
npm run migration:run:dev
npm run start:dev

# 3. Web app on :3000 (proxies /api to the API)
cd ../frontend
npm ci
API_URL=http://localhost:3001 npm run dev
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. The first admin is created on the first start only.

### Tests

The integration tests need the Postgres container above. They create and drop the database `app_test`, so create it first:

```bash
docker exec tourney-orga-pg psql -U app -c "create database app_test;"
cd backend
npm run test:all   # unit + integration tests with coverage
npm run lint
```

### Database changes

The schema is changed only through migrations (`synchronize` is off everywhere):

```bash
npm run migration:generate -- src/database/migrations/DescribeTheChange
npm run migration:run:dev
```

All earlier migrations were consolidated into a single `InitialSchema` on 2026-09-27. A database created before then has to be recreated: drop it, create it empty, and run `npm run migration:run:dev`.

## Manual sending (optional)

Sending through Gmail is optional.
- **Switching it on or off:** set **Settings → Sending mode** to *Manual*.
- **Running without a mailbox:** set `MAIL_AUTH_MODE=NONE`. The app then works entirely in manual mode, and invitations are shared as a copyable link.

In manual mode, due emails appear on the dashboard as "ready to send". For each team, copy the recipients, subject and formatted body (or open them in your mail app), send the email yourself, and click **Mark as sent** or **Mark as sent & next**.

## Google Workspace setup (one-time)

Emails are sent via `smtp.gmail.com` from the mailbox in `MAIL_USER`.

**Recommended: OAuth2** (`MAIL_AUTH_MODE=OAUTH2`)
1. In the [Google Cloud console](https://console.cloud.google.com/), create a project inside your Workspace organization.
2. Set up the OAuth consent screen with **User type: Internal**. Internal apps need no Google review, and their refresh tokens do not expire after 7 days.
3. Create credentials: **OAuth client ID → Web application**. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
4. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
   1. Under ⚙️, tick **Use your own OAuth credentials** and enter the client ID and secret.
   2. Authorize the scope `https://mail.google.com/` while signed in as the sending mailbox.
   3. Exchange the code for tokens.
5. Put the client ID, client secret and refresh token into `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN`.

**Alternative: app password** (`MAIL_AUTH_MODE=APP_PASSWORD`). Needs 2-Step Verification on the account, and your Workspace admin must allow app passwords. Put the 16-character password in `MAIL_APP_PASSWORD`.

**Deliverability (Workspace admin):**
- Turn on **DKIM** in the Admin console (Apps → Google Workspace → Gmail → Authenticate email). It is off by default.
- Make sure SPF includes `_spf.google.com`.
- Make sure a DMARC record exists.

**Limits:** Workspace allows about 2,000 messages per day per user, counted over a rolling 24 h window. The app caps itself at 1,000 recipients per 24 h (To and CC both count, adjustable in Settings) to leave room for your normal email. If Gmail still reports its limit, the app pauses sending and shows a banner with a "Resume sending" button.

## Deployment (Coolify)

[deploy/coolify.sh](deploy/coolify.sh) sets everything up through the Coolify API (tested with Coolify 4.1.2). It creates one Coolify project with:

| Resource | What | Domain |
|---|---|---|
| `tourney-orga-db` | Managed PostgreSQL 16 with daily Coolify backups | internal only |
| `tourney-orga-api` | `backend/Dockerfile` (port 3001) | https://tourney-orga-api.challenge-limits.com |
| `tourney-orga-web` | `frontend/Dockerfile` (port 3000) | https://tourney-orga.challenge-limits.com |

- **Automatic deploys:** both apps build from GitHub through the Coolify GitHub App `tourney-orga` (setting `COOLIFY_GITHUB_APP_NAME`). Every push to `main` redeploys the app whose folder changed: watch paths `backend/**` and `frontend/**`.
- **How the UI reaches the API:** the UI proxies `/api` to the API over Coolify's internal network, using the network alias `tourney-orga-api`. The browser only ever talks to the UI domain, so cookies stay first-party.
- **Why the API domain is public:** for the one-click unsubscribe links in emails.
- **Migrations:** the API runs pending migrations on start (`RUN_MIGRATIONS=true`, behind a database lock).
- **First admin:** created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` when the database is empty.

**Setup**

```bash
cp deploy/.env.coolify.example deploy/.env.coolify   # fill in the Coolify URL, token, server UUID, ADMIN_EMAIL
./deploy/coolify.sh status   # checks the connection
./deploy/coolify.sh init     # creates the database, API and UI, then deploys both
```

`init` generates `POSTGRES_PASSWORD`, `JWT_SECRET` and `ADMIN_PASSWORD` if they are empty and saves them in `deploy/.env.coolify`. That file and `deploy/.coolify-state` are gitignored.

**Commands**

| Command | What it does |
|---|---|
| `init` | Creates the project, database (with a backup schedule), API and UI, pushes the configuration and deploys both. The apps build from the GitHub App with auto-deploy. Safe to re-run: existing resources are reused. An app that does not build from the GitHub App is deleted and recreated (the database is kept). |
| `update [backend\|frontend\|all]` | Pushes the configuration (env vars, domains, ports) and redeploys. Use it after changing `deploy/.env.coolify`. Code changes deploy on push. |
| `reset [--yes]` | **Deletes the database with all its data** and its backup schedule, then creates an empty one and redeploys the API. Migrations run and the first admin is created again. |
| `teardown [--yes]` | **Deletes the apps, the database with all its data and the project.** `deploy/.env.coolify` is kept. |
| `status` | Shows each resource's state and whether both domains respond. |

`reset` and `teardown` ask you to type the project name. `--yes` skips that question (for scripts).

**Mail:** `MAIL_AUTH_MODE=NONE` (the default) runs the app in manual sending mode. To send through Gmail, fill in the Google settings in `deploy/.env.coolify` and run `./deploy/coolify.sh update backend`.

**Without the script:** [docker-compose.yml](docker-compose.yml) still runs the whole stack on any Docker host (`docker compose up`). Its one-off `migrate` service runs the migrations.

## Repository layout

```
backend/src/modules/
  auth/        login, sessions (JWT cookie), CSRF guard, password reset
  user/        admins, invitations
  team/        teams, age groups, CSV import/export
  template/    email templates, placeholder rendering, preview
  email/       participation email steps, email plans, variables, send-time calculation
  attention/   work queue
  tournament/  tournaments, participations, participation process
  delivery/    scheduler, SMTP sender, quota, unsubscribe endpoints
  settings/    organizer settings, sending pause
  mail/        Gmail transport, email layout
frontend/src/
  app/         routes: (public) login/invite/reset/unsubscribe, (app) signed-in area
  components/  UI building blocks and feature components
  lib/         API client, contract types, date helpers
```
