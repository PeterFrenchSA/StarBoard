# StarBoard on Coolify

Production: https://starboard.virdict.com — deploy the `main` branch with the root Dockerfile.

Create a private PostgreSQL 16 resource in the same Coolify environment. Keep its storage persistent and its port private. Create a Dockerfile application exposing port 3000, with HTTPS and a health check at `GET /api/health` (30-second interval, 5-second timeout, 60-second startup grace period). One application instance is currently intended; request rate limits use process memory.

Set these as **runtime-only secrets** in Coolify:

- `DATABASE_URL` and `DIRECT_URL`: the database's internal PostgreSQL URL.
- `AUTH_SECRET` and `VOICE_TOKEN_SALT`: independently generated strong random secrets.
- `APP_URL=https://starboard.virdict.com`
- `NODE_ENV=production`, `PORT=3000`

Builds use a dummy database URL and do not need production secrets or a live database. Startup applies committed Prisma migrations before accepting requests. Never run `prisma:seed` or `db:reset` in production: the demonstration seed deletes existing records.

## First administrator

Before opening a fresh installation to public registration, keep temporary proxy authentication enabled. Run `node scripts/bootstrap-admin.cjs` inside the application container, supplying a JSON object on standard input with `email`, `password`, and `displayName`. Use a private file or secret input; do not put the password in command arguments or Git.

The bootstrap requires an empty User and Family table, hashes the supplied password, and creates a single provider administrator plus the administrative family required by the schema. Repeating it refuses to change data. It does not create demonstration families, children, tasks, rewards, or a subscription. Remove the temporary proxy authentication after verifying login.

The administrator signs in at `/login` and uses `/provider`. Family parents register separately at `/register` with another email; provider and parent accounts have distinct roles.

## Payments

Stripe is optional and is not configured by this deployment. Paid checkout requires real Stripe keys, price configuration and a webhook endpoint. Review the subscription-lifecycle gaps in `code-review-2026-09-20.md` before launching paid subscriptions. Do not deploy the sample Stripe values from environment examples.

## Updating and recovery

Push reviewed changes to `main`, then select Deploy in Coolify. Automatic deployment is initially disabled. Back up the database before schema-changing releases. Application rollback does not undo database migrations.

Keep PostgreSQL dumps and Coolify configuration/encryption keys in an access-controlled off-server backup. The deployment handover includes an initial recovery archive, but scheduled off-server backups require separate setup. There are no user-upload volumes for this version.

## Validation

Run lint, type checking, unit/API tests, Storybook browser tests, and the end-to-end suite against a disposable database. Set `PLAYWRIGHT_ALLOW_MUTATIONS=1` only for that disposable environment. Full provider/webhook coverage additionally uses `PLAYWRIGHT_PROVIDER_EMAIL`, `PLAYWRIGHT_PROVIDER_PASSWORD` and `PLAYWRIGHT_WEBHOOK_SECRET`.

Production cookies require HTTPS. For a local self-signed HTTPS test proxy only, set `PLAYWRIGHT_LOCAL_TLS=1` and trust its test certificate for Node using `NODE_EXTRA_CA_CERTS`. This setting relaxes certificate validation in the test browser only; it does not change application cookies or production TLS.

The September 2026 dependency audit reports 8 advisories (3 high, 4 moderate, 1 low), mainly in Prisma/tooling and the test toolchain. These remain tracked in the existing review; no forced major dependency upgrade was applied as part of deployment.
