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

1. Create a **Docker Compose** resource from this repository ([docker-compose.yml](docker-compose.yml)).
2. Add the variables from [.env.example](.env.example) in Coolify's environment settings. Use a long random `JWT_SECRET` (`openssl rand -base64 48`) and `COOKIE_SECURE=true`.
3. Assign your domain to the `web` service. The API is reached only through the web app's `/api` proxy, so `APP_URL` and `API_PUBLIC_URL` are both that domain.
4. Deploy. The `migrate` service runs pending migrations before `api` starts, and API containers never run migrations themselves.
5. Set up daily PostgreSQL backups for the `pgdata` volume in Coolify.

`API_URL` for the web app is baked in at build time (a Docker build arg; default `http://api:3001`).

## Repository layout

```
backend/src/modules/
  auth/        login, sessions (JWT cookie), CSRF guard, password reset
  user/        admins, invitations
  team/        teams, groups, CSV import/export
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
