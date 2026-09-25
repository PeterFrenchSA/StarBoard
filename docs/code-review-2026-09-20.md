# StarBoard Code Review - 2026-09-20

## Scope and Verdict

Reviewed the current `codex/starboard-audit-hardening` working tree, including existing uncommitted audit work. The review covered authentication, family isolation, onboarding, tasks/timers/approvals, the points ledger, rewards, voice tokens, billing, support/provider operations, dashboard rendering, PWA caching, dependencies, and Docker/operations scripts.

Changes focus on demonstrated correctness, security, reliability, and usability issues rather than architectural rewrites. No database schema changes or new migrations are introduced. Existing working-tree changes were retained; this report does not imply a commit or deployment.

Core family workflows passed the checks below. **This is not clearance for paid public launch:** the billing lifecycle findings below remain open. Passing tests do not prove that every feature, browser, external integration, or production failure mode has been covered.

## Open Findings, Highest Priority First

### P1: Subscription price does not follow later child-count changes

`src/app/api/billing/checkout-session/route.ts` computes a fixed subscription price when checkout starts. `src/app/api/parent/children/route.ts` does not update that subscription when another child is added. The displayed pricing can therefore diverge from what Stripe collects. Provider plan adjustments have the same reconciliation concern. Before paid launch, implement an explicit subscription-update/reconciliation flow, define proration policy, and test monthly and annual changes in Stripe test mode.

### P1: Pending checkouts and event ordering need lifecycle protection

Checkout now refuses a known, non-canceled subscription, and transient customer lookup errors no longer create a replacement customer. However, two requests before the first checkout finishes can still create separate sessions/customers; there is no persistent pending-checkout claim or Stripe idempotency key. Completing both sessions could create duplicate subscriptions.

`src/app/api/stripe/webhook/route.ts` now processes each event and its deduplication marker atomically. Different events arriving out of order can still overwrite newer subscription state because handlers apply event snapshots without reconciling the current Stripe subscription. These require persistent lifecycle state and test-mode coverage, not just request deduplication. Stripe documents both duplicate and unordered delivery in its [webhook guidance](https://docs.stripe.com/webhooks).

### P2: Recurrence and streaks depend on the server timezone

`src/lib/tasks/recurrence.ts` and `src/lib/tasks/streak.ts` use local calendar-day functions without a family timezone. A macOS host, UTC container, and families in other timezones can disagree about daily boundaries. Introduce an explicit family timezone with a migration and boundary tests before regional hosting. Existing stored current streaks also do not expire on read after missed days; the next completion updates them. Avoid presenting these as timezone-independent calculations.

### P2: Remaining dependency advisories

After compatible dependency updates, `npm audit --omit=dev` reports three high-severity package records for one underlying [deepmerge-ts recursive-merge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), through `@prisma/config` and `prisma`. Prisma tooling is shipped in the runtime image for migrations. No untrusted request-to-recursive-config-merge path was demonstrated during this review, but that does not establish non-exploitability.

The complete dependency audit additionally reports development-tool advisories through the Vitest browser/mocker chain and esbuild. The suggested Prisma downgrade and major test-tool migrations were not forced into this patch. Track compatible upstream fixes, keep tooling inaccessible publicly, and rerun both audit commands before release. Audit counts are a dated snapshot, not a guarantee.

### P2: Multi-node operation needs shared protections

`src/lib/rate-limit.ts` is now bounded in memory and preserves active counters under capacity pressure, but counters remain process-local and reset on restart. Add a shared limiter before deploying multiple app instances. The Nginx example now overwrites client-supplied forwarding headers; any CDN or other proxy must have an explicitly configured trusted-proxy chain. Do not expose the app port directly on a public VPS.

### Follow-up: Production image packaging

The production image runs as a non-root user and contains the generated Prisma client, but retains tooling dependencies for migrations. It still uses `next start` with standalone output configured, which emits a Next.js warning. The tested server works; a future packaging change should consistently use the standalone launcher with the required public/static assets and separate migration tooling, then repeat container-level tests. This is a size/startup concern, not a reason to weaken runtime security.

## Fixes Implemented

| Area | Problem addressed | Implementation |
| --- | --- | --- |
| Task completion | Duplicate submissions and partial completion/points/streak writes | Shared transactional submission service for child and voice routes, conditional timer consumption, conflict responses |
| Task review | Concurrent approval/rejection could disagree with awarded points | Conditional pending-state transition, ledger, streak, and activity in one serializable transaction |
| Rewards | Duplicate pending requests and concurrent approvals could overspend | Serializable balance checks and pending-state transitions, atomic deductions and audit records |
| Manual points | Ledger and activity could diverge after a partial failure | Parent and voice writes share a transaction |
| Accounts | Account creation could succeed without its audit record; duplicate-email races | Transactional child/co-parent creation, safe response fields, conflict handling |
| Onboarding | Password hashing consumed interactive transaction time | Hash child passwords before opening the transaction |
| Dashboard logic | Older task completions disappeared from availability checks after the latest 50 entries | Query relevant completion state per assigned task, independently of the history limit |
| Session routing | Stale signed cookies could cause login/dashboard redirect loops | Login/register pages defer to database-validated sessions rather than cookie-only proxy redirects |
| PWA | Redirected login pages or private/RSC responses could enter shared caches | Cache only offline shell/icons/static assets; never API or authenticated document responses |
| CSV export | Spreadsheet formulas in feature-request fields | Neutralize formula-prefixed cells before CSV quoting |
| Billing errors | Transient Stripe failures could discard a valid customer link | Preserve links; return structured unavailable/error responses; reject known duplicate subscriptions |
| Stripe retries | Webhook side effects could commit separately from the processed-event marker | Transactional event application and deduplication |
| Dependencies | Outdated framework and compatible transitive packages | Next.js/eslint-config-next 16.3.5, Prisma 6.19.3, compatible lockfile updates; remaining advisories documented |
| Docker development | Stale dependency volumes caused missing Prisma binaries | Synchronize dependencies from the rebuilt image using a lockfile marker; fail clearly for stale images |
| Docker production | Missing generated Prisma files, environment files in build context | Copy generated client/config; exclude environment secrets; use ownership-aware copies |
| Deployment health | An authentication error could count as a healthy application | New no-store `/api/health` tests database/schema access; deploy checks require HTTP 200/204 |
| Rollback | Previous Git commit need not be a successfully deployed release | Select previous successful deployment log entry; refuse dirty tracked files; detached checkout |
| Database operations | Failed backups looked complete; bad restores could leave an empty schema | Private partial backups with atomic rename; validate gzip and restore in a single SQL transaction; exclude the default backup directory from Git and Docker builds |

Serializable retries are restricted to aborted Prisma `P2034` transactions and database-only callbacks. External Stripe calls are not placed inside these retryable callbacks. See [Prisma transaction guidance](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).

## Visual and Accessibility Improvements

- Kept the established cosmic theme and artwork rather than replacing the design.
- Made the child hero and theme controls more compact on phones, including narrow 320px layouts.
- Kept the reward percentage stationary while only its decorative ring rotates.
- Made Missions, Done, and Ready summaries jump to their corresponding sections.
- Improved button and statistic contrast, keyboard focus visibility, theme-selection semantics, and scroll-region access.
- Added reduced-motion handling and stopped the dashboard timer interval when no active task timer exists.
- Clarified the no-rewards state and bounded reward progress to 0-100%.
- Parent menu changes use client-side navigation rather than unnecessary full reloads.

## Verification Results

All database-changing checks used disposable audit databases, not the existing local family database. Temporary provider credentials and webhook secrets were test-only. Existing user containers were not reset.

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript / Next route generation | Passed |
| Unit/API suite | 56 tests passed across 23 files |
| Storybook browser suite | 36 tests passed |
| Production build | Passed locally and in the Node 22 Debian/Linux Docker image |
| Playwright against the production image | 3 tests passed, including the opt-in mutation workflow and optional provider/webhook branches |
| Health failure injection | HTTP 200 with the database available; HTTP 503 while only the disposable audit database was stopped |
| Runtime inspection | Non-root application user; no `.env*` files found in `/app` |
| Backup/restore | Restored a disposable database; invalid SQL preserved original data; corrupt gzip rejected before mutation |
| Responsive checks | Child/parent at 390px and 1440px; Engineering child theme at 320px; no horizontal overflow in checked views |
| Automated accessibility | No WCAG A/AA axe violations in the final checked default child and parent mobile Storybook views |
| Shell / whitespace checks | Bash/sh syntax and `git diff --check` passed |

The opt-in workflow covers registration/onboarding, two children, co-parent creation, role/family/origin isolation, concurrent submissions and reviews, task allocation, timer/deadline enforcement, point adjustments, concurrent reward requests/redemptions, voice authentication and revocation, support isolation, provider internal-note privacy/export, signed webhook deduplication, theme persistence, dashboard rendering, and logout. Most mutations are exercised through real HTTP requests; this is not a click-through test of every form.

Production cookies remain Secure. For local HTTP testing of the production image, `localhost` succeeded; `127.0.0.1` caused the Playwright request cookie jar to omit the cookie. Use HTTPS for real deployments, not relaxed cookies.

Not verified: live Stripe payments/customer portal, proration or cancellation lifecycle, native Siri/Google Home integrations, physical-device PWA installation, all themes in every browser, sustained load, a fresh Ubuntu bootstrap, actual public TLS/CDN setup, or executing rollback against a live deployment. Automated accessibility checks do not replace keyboard/screen-reader testing.

## Repeatable Local Checks

Use Node 22 and npm. With the existing `.env` and `.env.docker` configured:

```bash
docker compose up -d --build
docker compose exec app npm run prisma:deploy
docker compose logs --tail=100 app
```

Open `http://localhost:3000`. No reset or seed is needed to apply this review. The existing `db:reset` command is destructive; do not run it against data you want to keep. It now skips Prisma's implicit seed before invoking the explicit seed once.

Host-side checks:

```bash
npm ci
npx playwright install chromium
npm run prisma:generate
npm run lint
npm run typecheck
npm run test:unit
npm run test:storybook
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
npm run build
npm audit --omit=dev
npm audit
```

Run the mutation workflow only against an app backed by a disposable database. It creates uniquely named families and leaves those test records in that database:

```bash
PLAYWRIGHT_ALLOW_MUTATIONS=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

For the optional provider branch, supply `PLAYWRIGHT_PROVIDER_EMAIL` and `PLAYWRIGHT_PROVIDER_PASSWORD` for an existing test super-admin. For the synthetic signed webhook branch, set `PLAYWRIGHT_WEBHOOK_SECRET` to the test app's `STRIPE_WEBHOOK_SECRET`; a configured test Stripe client key is also required. Never direct these mutation tests at production.

Do not run `next build` against the same `.next` directory as a running host development server. Docker development uses its own named build-cache volume, so host build checks do not overwrite that container's cache.

## Deployment and Rollback Notes

- No schema migration is added. Apply existing committed migrations as usual.
- Change an existing production `APP_HEALTHCHECK_URL` from `/api/auth/me` to `/api/health`. The template now defaults to `http://127.0.0.1:3000/api/health`; adjust its port if necessary.
- Production Compose now binds the app to loopback. Use the documented host Nginx reverse proxy with HTTPS; containerized proxies need their own Docker networking arrangement.
- Rebuild the Docker image after pulling dependency changes; do not reuse stale development dependency volumes without the new startup synchronization.
- Take a backup before deployment. Rollback restores application code, not database history. Future migrations must remain compatible with the previous deployed app, or require a separately planned database restore.
- A single Compose app container still has a brief restart interruption. No zero-downtime claim is made.
- Deploy this branch only after reviewing its full diff and completing the billing work if accepting real subscriptions. No commit, push, public deployment, or production reset was performed by this review.
