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
- Parent control center:
  - child summaries and activity
  - recurring/one-off tasks
  - pending task approvals
  - manual points adjustments
  - reward management
  - reward approval/rejection
- Child dashboard:
  - points, streaks, badges
  - assigned tasks and completion flow
  - reward progress and redemption requests
  - points/task history
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

Dataset 1 (`Skywalkers - Task Allocation`):
- Parent: `parent@starboard.local` / `ChangeMe123!`
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
- `NODE_ENV`
- `PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SEED_PARENT_EMAIL`
- `SEED_PARENT_PASSWORD`
- `SEED_VOICE_TOKEN`

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

### One-time bootstrap

```bash
./scripts/bootstrap-server.sh
```

This script installs Docker, Docker Compose plugin, and Git (if missing), clones/updates the repo, initializes `.env` from template, and runs deployment.

### Deploy current branch

```bash
./scripts/deploy.sh
```

Deploy script behavior:

- pulls latest Git code
- builds app image
- starts PostgreSQL
- waits for DB readiness
- runs Prisma migrations
- restarts app container
- prunes old unused images

### Update with rollback support

```bash
./scripts/update-app.sh
```

If update fails after pull/build/migrate, script rolls back to previous Git commit and restarts previous container image.

## Production Compose Notes

`docker-compose.prod.yml` runs:

- `db` (Postgres 16)
- `app` (Next.js container)

Set secure values in `.env` before deploy:

- strong `AUTH_SECRET`
- strong `VOICE_TOKEN_SALT`
- non-default `POSTGRES_PASSWORD`
- production `APP_URL`

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
