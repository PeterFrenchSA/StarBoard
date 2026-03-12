# StarBoard

StarBoard is a self-hostable family star chart and rewards app built with Next.js, Prisma, and PostgreSQL. It supports parent and child roles, recurring tasks, approvals, points, rewards, activity audit logs, voice-ready API endpoints, and installable PWA behavior.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Email/password auth with secure hashing and HttpOnly JWT session cookie
- Docker + Docker Compose (local and Ubuntu VPS production)
- Vitest unit tests + Playwright e2e smoke test

## MVP Features

- Parent creates family workspace and manages children
- Child and parent separate logins with role enforcement
- Multi-parent family support (owner parent can add more parents)
- Stripe-ready subscription billing model:
  - `$5/month` parent plan with 2 included children
  - `$2/month` per additional child
  - annual option at `10x` monthly equivalent
- Provider admin console (`/provider`) for global subscription + support operations
- Parent control center:
  - first-time setup wizard (family personalization, children, starter tasks, starter rewards)
  - child summaries and activity
  - recurring/one-off tasks with optional deadline and timer
  - recurring task assignment to multiple children at once
  - pending task approvals
  - manual points adjustments
  - reward management
  - reward approval/rejection
  - per-parent voice token management
  - in-app support ticket creation and replies
  - feature request submission from the same ticketing flow
  - billing actions (checkout + portal)

### Parent Navigation Layout

The parent experience is split into focused sub-menus:

- `/parent` main dashboard (children, tasks, rewards, activity)
- `/parent/approvals` pending task/reward reviews
- `/parent/billing` subscription and Stripe actions
- `/parent/integrations` voice token management
- `/parent/support` support + feature request ticketing
- `/parent/admin` parent/child account administration
- Child dashboard:
  - points, streaks, badges
  - assigned tasks and completion flow
  - reward progress and redemption requests
  - points/task history
  - child-selectable themes: Fairies, Dragons, Ninjas, Engineering
- Activity/audit logging for key actions
- Voice-ready token-auth endpoints:
  - `POST /api/voice/add-points`
  - `POST /api/voice/complete-task`
  - `GET /api/voice/child-summary`
  - `GET /api/voice/family-summary`
- PWA support:
  - app manifest
  - service worker shell caching
  - install prompt support

## Suggested Folder Structure (PR #1 Foundation)

```text
src/
  app/
    (public)/
      login/
      register/
    (app)/
      parent/
      child/
    api/
      auth/
      parent/
      child/
      voice/
    globals.css
    layout.tsx
    page.tsx
  components/
    dashboard/
    ui/
    pwa/
  lib/
    auth/
    validation/
    tasks/
    rewards/
    points/
prisma/
  schema.prisma
  seed.ts
  migrations/
scripts/
  bootstrap-server.sh
  deploy.sh
  update-app.sh
  rollback.sh
  backup-db.sh
  restore-db.sh
  lib.sh
ops/
  nginx/
    starboard.conf.example
bootstrap-server.sh
deploy.sh
update-app.sh
rollback.sh
```

## Quick Start (Docker, macOS/Linux)

1. Copy env file:

```bash
cp .env.example .env
```

2. Update `.env` values (especially `AUTH_SECRET`, `VOICE_TOKEN_SALT`, and DB password).

3. Start local stack (`app + db`):

```bash
docker compose up --build
```

4. Run seed data (in another shell):

```bash
docker compose exec app npm run prisma:seed
```

5. Open app:

- [http://localhost:3000](http://localhost:3000)

## Seed Credentials

From default `.env.example`:

- Child password for all seeded children: `StarKid123!`
- Super admin:
  - `admin@starboard.local` / `AdminPass123!`

Dataset 1 (`Skywalkers - Task Allocation`):
- Parent: `parent@starboard.local` / `ChangeMe123!`
- Co-parent: `coparent@starboard.local` / `ChangeMe123!`
- Children: `leia@starboard.local`, `william@starboard.local`
- Voice token: `starboard-voice-dev-token`

Dataset 2 (`Guardians - Approval Flow`):
- Parent: `parent.approvals@starboard.local` / `ChangeMe123!`
- Children: `asha@starboard.local`, `noah@starboard.local`
- Voice token: `starboard-voice-approvals`

Dataset 3 (`Rangers - Reward Redemption`):
- Parent: `parent.rewards@starboard.local` / `ChangeMe123!`
- Children: `mia@starboard.local`, `liam@starboard.local`
- Voice token: `starboard-voice-rewards`

Change these in production.

## Environment Variables

See `.env.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `AUTH_SECRET`
- `VOICE_TOKEN_SALT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CURRENCY`
- `NODE_ENV`
- `PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SEED_PARENT_EMAIL`
- `SEED_PARENT_PASSWORD`
- `SEED_VOICE_TOKEN`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Database and Prisma

Generate client:

```bash
npm run prisma:generate
```

Create/apply local migrations in dev:

```bash
npm run prisma:migrate
```

Apply committed migrations (production-safe):

```bash
npm run prisma:deploy
```

Seed:

```bash
npm run prisma:seed
```

## Tests and Quality

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E smoke test (app must already be running):

```bash
npm run test:e2e
```

## Storybook (UI Wireframes and Design Iteration)

Run Storybook locally:

```bash
npm run storybook
```

Open:
- [http://localhost:6006](http://localhost:6006)

If port `6006` is busy:

```bash
STORYBOOK_PORT=7007 npm run storybook
```

Build static Storybook:

```bash
npm run build-storybook
```

Storybook includes:
- UI primitives (`Button`, `Card`, `Progress`, `ProgressRing`, `Toast`)
- realistic dashboard fixture stories (`Parent`, `Child`, `Provider`) with mocked API responses

If you run inside Docker, use:

```bash
docker compose exec app npm run storybook
```

## Voice Endpoint Usage

Auth header:

```http
Authorization: Bearer <VOICE_TOKEN>
```

### Add points

```bash
curl -X POST http://localhost:3000/api/voice/add-points \
  -H "Authorization: Bearer starboard-voice-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"childName":"Leia","amount":10,"note":"Great morning routine"}'
```

### Complete task

```bash
curl -X POST http://localhost:3000/api/voice/complete-task \
  -H "Authorization: Bearer starboard-voice-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"childName":"William","taskTitle":"Room tidy-up"}'
```

### Child summary

```bash
curl "http://localhost:3000/api/voice/child-summary?childName=Leia" \
  -H "Authorization: Bearer starboard-voice-dev-token"
```

### Family summary

```bash
curl "http://localhost:3000/api/voice/family-summary" \
  -H "Authorization: Bearer starboard-voice-dev-token"
```

### Voice response format

All voice endpoints return a consistent envelope:

```json
{
  "ok": true,
  "data": {},
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

Error example:

```json
{
  "ok": false,
  "error": "Unauthorized voice token",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

Voice endpoints are family-scoped, token-authenticated, validated with Zod, and rate-limited.

## Billing and Platform APIs

- Parent billing:
  - `POST /api/billing/checkout-session` (monthly/annual Stripe checkout)
  - `POST /api/billing/portal-session` (Stripe customer portal)
- Stripe webhook:
  - `POST /api/stripe/webhook`
- Parent support:
  - `GET /api/parent/support/tickets`
  - `POST /api/parent/support/tickets`
  - `POST /api/parent/support/tickets/:ticketId/messages`
- Parent voice token management:
  - `GET /api/parent/voice/tokens`
  - `POST /api/parent/voice/tokens`
  - `PATCH /api/parent/voice/tokens/:tokenId`
- Provider management:
  - `GET /api/provider/overview`
  - `PATCH /api/provider/tickets/:ticketId`
  - `POST /api/provider/tickets/:ticketId/messages`
- `GET /api/provider/feature-requests/export` (CSV export)

Note: seeded demo families include placeholder Stripe IDs for UI demos. In local test mode, start a real checkout first to link a valid Stripe customer before opening the billing portal.

## Multi-Tenant Notes

- A family can now have multiple parent logins.
- Family owner can create additional parent accounts from the parent dashboard admin section.
- Provider admin users (`SUPER_ADMIN`) log in normally and are routed to `/provider`.
- Family data remains isolated by `familyId`, while provider APIs are restricted to `SUPER_ADMIN`.

## Scaling Guidance

- Current default topology: single VPS with Docker Compose (`app + postgres`).
- Near-term scale path:
  - put Nginx or Caddy in front of app container
  - enable Cloudflare DNS/CDN for static asset and edge caching
  - move PostgreSQL to a dedicated node before horizontal app scaling
- Multi-region progression:
  - keep write-primary PostgreSQL in one region first
  - add read replicas + region-local app workers for read-heavy traffic
  - move asynchronous tasks (support notifications, webhook fanout) to a queue worker service
- Keep webhook and session secrets synchronized across nodes during scaling.

## Siri Shortcuts / Google Assistant Readiness

The voice endpoints are designed for private household automation and can be wired into shortcut tools:

- Use bearer token authentication with salted token hashing in DB.
- In Apple Shortcuts:
  - create a `Get Contents of URL` action
  - set method (`POST` or `GET`), URL, JSON body, and `Authorization: Bearer <token>` header
  - optionally parse `data.points` or `data.leaderboard[0]` from JSON result for spoken feedback
- In Google Home / Google Assistant automations:
  - trigger a webhook-capable automation action
  - call the same voice endpoints with bearer token header
  - map structured JSON response fields into spoken confirmations
- Keep the token in device secret storage where possible.
- Rotate tokens by updating `VoiceApiToken` records.
- Recommended first shortcuts:
  - `Add 10 points for Leia` -> `/api/voice/add-points`
  - `Complete William room task` -> `/api/voice/complete-task`
  - `How many stars does Leia have?` -> `/api/voice/child-summary`
  - `Family leaderboard` -> `/api/voice/family-summary`

## Ubuntu VPS Deployment

Use these files:

- `bootstrap-server.sh` (wrapper)
- `deploy.sh` (wrapper)
- `update-app.sh` (wrapper)
- `rollback.sh` (wrapper)
- `scripts/bootstrap-server.sh`
- `scripts/deploy.sh`
- `scripts/update-app.sh`
- `scripts/rollback.sh`
- `docker-compose.prod.yml`
- `.env.production.example`

### 1. Prepare Ubuntu VPS

DNS / reverse proxy note:
- Point your domain to the VPS.
- Use a reverse proxy (Nginx/Caddy/Traefik) with TLS termination.
- Example Nginx config: `ops/nginx/starboard.conf.example`

### 2. Run bootstrap once (on VPS)

```bash
ssh <user>@<server>
sudo -v
git clone https://github.com/PeterFrenchSA/StarBoard.git /opt/starboard || true
cd /opt/starboard
./bootstrap-server.sh
```

What bootstrap does:
- verifies Ubuntu
- installs Git, Docker, Docker Compose plugin if missing
- prepares `/opt/starboard`
- clones/pulls repo
- creates `.env.production` from template if missing

### 3. Configure production env

```bash
cd /opt/starboard
cp .env.production.example .env.production   # if not created already
nano .env.production
```

Required secure values:
- `APP_URL`
- `AUTH_SECRET`
- `VOICE_TOKEN_SALT`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`

### 4. First deployment

```bash
cd /opt/starboard
ENV_FILE=.env.production DEPLOY_BRANCH=main ./deploy.sh
```

`deploy.sh`:
- pulls latest Git code (branch override supported)
- builds app image
- starts/updates containers
- runs Prisma migrations
- optionally seeds only when `RUN_SEED=true`
- runs app health check
- logs deployed commit SHA (`deployments.log`)
- prunes unused Docker images

### 5. App updates over time

```bash
cd /opt/starboard
ENV_FILE=.env.production DEPLOY_BRANCH=main ./update-app.sh
```

`update-app.sh` is a safe update wrapper around deploy flow with clear success/failure output.
It replaces only the app container (`up -d --no-deps app`) for near-zero downtime within Docker Compose constraints.

### 6. Rollback

Rollback to previous commit:

```bash
cd /opt/starboard
ENV_FILE=.env.production ./rollback.sh
```

Rollback to a specific commit:

```bash
cd /opt/starboard
ENV_FILE=.env.production ROLLBACK_COMMIT=<commit-sha> ./rollback.sh
```

### 7. Logs and runtime inspection

```bash
cd /opt/starboard
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f --tail=200 app db
```

### 8. Back up PostgreSQL volume data

Create compressed SQL dump:

```bash
cd /opt/starboard
ENV_FILE=.env.production ./scripts/backup-db.sh
```

Default backup location:
- `./backups` (override with `BACKUP_DIR` in `.env.production`)

### 9. Restore PostgreSQL from dump

```bash
cd /opt/starboard
ENV_FILE=.env.production ./scripts/restore-db.sh ./backups/starboard-YYYYMMDD-HHMMSSZ.sql.gz
```

### 10. Optional Makefile shortcuts

```bash
make deploy ENV_FILE=.env.production DEPLOY_BRANCH=main
make update ENV_FILE=.env.production DEPLOY_BRANCH=main
make rollback ENV_FILE=.env.production
make logs ENV_FILE=.env.production
make backup ENV_FILE=.env.production
```

## Security Notes

- Passwords hashed with bcrypt
- HttpOnly + same-site session cookie
- Role-based route and API checks
- Family ID data isolation in queries
- Zod input validation for API payloads
- Origin checks for session-auth POST routes
- In-memory rate limiting on auth/voice endpoints

## PWA Notes

- Manifest at `src/app/manifest.ts`
- Service worker at `public/sw.js`
- Install prompt support in app shell (`beforeinstallprompt`)
- Maskable app icon included for Android launchers
- Offline fallback route: `/offline`
