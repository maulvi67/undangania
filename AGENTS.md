# Agent Operating Contract

## Mandatory reading order

1. `PROJECT_CONTEXT.md`
2. `CODEBASE_MAP.md`
3. Relevant file in `docs/domains/`
4. Relevant architecture, API, database, security, and testing docs
5. Active task in `.ai/tasks/`

## Universal workflow

Inspect → map requirements → analyze impact → propose plan → obtain approval for risky work → implement minimal coherent changes → test → review → document → handoff.

## Universal constraints

- npm only; commit `package-lock.json`.
- TypeScript strict; do not bypass with `any` or suppressions.
- Server Components by default in Next.js.
- Business rules live in domain/application packages, never route/page components.
- Database access is only through database repositories.
- Every tenant-bound operation includes `tenantId` and resource authorization.
- Every external input is server-validated.
- Critical mutations use transactions, audit, and outbox when side effects exist.
- Payment state comes from verified server-to-server notification/reconciliation, not redirects.
- AI output is draft-only and requires human approval before publication or chargeable action.

## High-risk changes requiring human approval

Authentication/session, authorization roles, database destructive or production migration, payment/webhook/refund, production infrastructure, secrets, data retention/deletion, custom-domain DNS, vendor payout, and AI model/provider cost changes.

## Required completion evidence

Files changed, requirement/task IDs, architecture impact, schema/API changes, security/privacy impact, tests and results, migration/rollback, documentation updates, known risks, and next action.
