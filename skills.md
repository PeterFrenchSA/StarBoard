# StarBoard Skills Audit

## Branch

- Working branch: `codex/starboard-audit-hardening`

## Current Review: 2026-09-20

See `docs/code-review-2026-09-20.md` for the current findings, verification evidence, exact test commands, and deployment notes. The earlier audit below is retained as historical context, not a replacement for the current report.

- Added shared serializable transactions for task completion, approval, points, and redemption consistency under concurrent requests.
- Hardened account creation, stale-session routing, private PWA caching, CSV exports, rate-limit memory use, and Stripe retry/error handling.
- Improved child dashboard responsiveness, navigation, contrast, motion preferences, and empty states without replacing the theme system.
- Hardened Docker dependency synchronization, production health checks, environment exclusion, backup/restore, and rollback selection.
- Verified 56 unit/API tests, 36 Storybook browser tests, and 3 production-image end-to-end tests, including optional provider and synthetic webhook coverage.
- Verified disposable PostgreSQL backup/restore failure cases and mobile/desktop dashboard layouts.
- No schema changes in this review. Existing production health-check URLs must change to `/api/health`.
- Remaining release priorities: subscription repricing and lifecycle reconciliation, family timezones/streak expiry, dependency advisories, and shared rate limiting before multi-node deployment.
- Live Stripe payments, fresh Ubuntu bootstrap, physical-device PWA installation, and sustained-load behavior are not certified by this review.

## Earlier Audit Record

## Product Skills

- Parent and child email/password authentication with role-based routing
- Multi-parent family workspaces with isolated family data
- Child dashboards with themes, streaks, points, badges, tasks, rewards, and activity
- Parent dashboard for task management, approvals, manual points, rewards, support, billing, and voice tokens
- Provider dashboard for platform operations, support triage, and feature request export
- Task system with one-off and recurring tasks, timer support, deadlines, approvals, and streak tracking
- Reward system with child redemption requests and parent approval flow
- Voice-ready API endpoints for points, task completion, child summary, and family summary
- PWA shell with manifest and service worker
- Docker-based local development and VPS-oriented deployment scripts

## Technical Skills

- Next.js App Router with TypeScript and Tailwind CSS
- Prisma + PostgreSQL data model for families, users, tasks, rewards, points, support, billing, and voice tokens
- JWT session cookies with server-side validation
- Same-origin checks for mutating browser routes
- Route-level RBAC for parent, child, and super-admin access
- Seeded local datasets for task allocation, approval flow, reward redemption, and provider operations
- Vitest coverage for core routes and business logic

## Audit Fixes Applied In This Pass

- Replaced raw dashboard payloads with explicit safe DTOs in [dashboard.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/src/lib/dashboard.ts)
- Prevented sensitive Prisma `User` fields from reaching parent and child dashboard clients
- Added regression tests for dashboard payload sanitization in [dashboard.test.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/src/lib/dashboard.test.ts)
- Moved deprecated Next route guard file from [middleware.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/src/middleware.ts) to [proxy.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/src/proxy.ts)
- Added shared client JSON fetch hardening in [fetch-json.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/src/lib/fetch-json.ts)
- Updated dashboard, login, registration, and setup wizard flows to use the safer client fetch helper
- Migrated deprecated Prisma package config to [prisma.config.ts](/Users/peterfrench/Documents/Codex%20Projects/StarBoard/prisma.config.ts)

## Local Verification Completed

- `docker compose up -d --build`
- `docker compose exec -T app npm run prisma:seed`
- `docker compose exec -T app npm run lint`
- `docker compose exec -T app npm run typecheck`
- `docker compose exec -T app npm run test`
- `docker compose exec -T app npm run build`

## Live Smoke Tests Completed

- Child login and child overview
- Child auto-approved task completion
- Parent login and parent overview
- Parent manual points adjustment
- Child reward request
- Child approval-required task submission
- Parent reward approval
- Parent task approval
- Voice add-points endpoint
- Voice child summary endpoint
- Voice family summary endpoint
- Parent feature request ticket creation
- Provider overview access
- Provider CSV export for feature requests

## Security Posture Notes

- Good:
- Role checks are consistently enforced on sensitive routes
- Browser-origin mutation routes perform same-origin checks
- Voice tokens are stored hashed, not plaintext
- Dashboard payloads are now intentionally shaped instead of returning raw ORM objects

- Still worth improving:
- In-memory rate limiting is acceptable for single-node dev/VPS use, but it is not shared across instances
- Playwright smoke test is present, but Docker image does not yet include browser binaries
- Stripe flows remain environment-dependent and should be exercised again in a fully configured billing environment

## Recommended Next Hardening Steps

- Move rate limiting to Redis or another shared store before multi-node scaling
- Add broader Playwright coverage for parent, child, and approval flows
- Add structured audit logging around support/admin actions if platform operations expand
- Review cookie/session rotation and revocation strategy if admin/security requirements increase
