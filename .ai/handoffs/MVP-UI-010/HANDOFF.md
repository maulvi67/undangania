# MVP-UI-010 Guest Management Handoff

## Status

**CONDITIONAL APPROVAL for fixture-backed UI; BLOCKED for live guest integration.**

## Objective and task

- Task: `MVP-UI-010-GUEST-MANAGEMENT`
- Objective: manage household-based guests, event access, personalized links, CSV import, and authorized export without exposing sensitive contacts or forcing a desktop table onto mobile.
- Implementation remains development-fixture-only. No live guest API, repository, authentication boundary, Prisma migration, or persistence was introduced.

## Context and decisions

Read and applied:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `CODEBASE_MAP.md`
- `docs/domains/guest-management.md`
- `ARCHITECTURE.md`
- `SECURITY_GUIDELINES.md`
- `TESTING_GUIDE.md`
- `.ai/tasks/MVP-UI-010-GUEST-MANAGEMENT.md`
- tenant-isolation-review procedure

Decisions:

- One household-level token remains the MVP fixture model.
- Contacts remain masked in detail and excluded from list DTOs.
- Token rotation/disable remains a local UI simulation; raw fixture links are not production tokens.
- CSV import requires preview, advisory duplicate review, and explicit confirmation.
- Export now has visible idle, processing, ready, and restricted states, but intentionally does not download fixture data.
- Dialogs restore focus to their invoking trigger after close.

## Files changed for this task

New:

- `apps/customer-web/src/components/guests/guest-export-action.tsx`
- `apps/customer-web/src/lib/guests/contract.test.ts`
- `apps/customer-web/src/lib/guests/pii.ts`
- `apps/customer-web/src/lib/guests/pii.test.ts`
- `apps/customer-web/src/components/guests/guest-import-wizard.test.tsx`
- `tests/integration/guest-tenant-isolation.integration.test.ts`
- `.ai/handoffs/MVP-UI-010/HANDOFF.md`

Updated:

- `apps/customer-web/src/components/guests/guest-management-view.tsx`
- `apps/customer-web/src/components/guests/guest-dialog.tsx`
- `apps/customer-web/src/components/guests/guest-bulk-actions.tsx`
- `apps/customer-web/src/components/guests/guest-link-panel.tsx`
- `apps/customer-web/src/components/guests/guest-household-detail.tsx`
- `apps/customer-web/src/components/guests/guest-import-wizard.tsx`
- `apps/customer-web/src/lib/guests/fixtures.ts`
- `apps/customer-web/src/app/guests.css`

Previously implemented guest scope in the same task includes the remaining files under:

- `apps/customer-web/src/app/tamu/`
- `apps/customer-web/src/components/guests/`
- `apps/customer-web/src/lib/guests/`

## Requirement evidence

- Household list, mobile cards, search, filters, tags, sort, event access, maximum pax: implemented in existing guest routes/components.
- Create/edit household: implemented with client validation and explicit fixture-only success copy.
- Personalized link, share-message copy, rotation, disable: implemented with masked-by-default display and one-time fixture link presentation.
- CSV import: upload, template, processing, preview, invalid rows, advisory duplicates, explicit duplicate opt-in, partial result, confirmation: implemented.
- Export: permission-aware action with processing/ready announcements and honest production boundary: added in `guest-export-action.tsx`.
- Required states: empty, filtered empty, loading, invalid CSV, partial import, duplicate, disabled link, export processing, permission denied, unavailable: represented by routes/fixtures.
- Privacy: safe list DTO schema rejects extra tenant/contact/token fields; diagnostic helper emits only household ID, member count, and link status.
- Tenant boundary: resource key includes `tenantId` and `weddingId`; household ownership assertion rejects IDs outside an authorized set.

## Architecture impact

No new production runtime boundary was added. The fixture transport remains a client-web development seam and explicitly documents that it does not authenticate, authorize, persist, or query tenant data.

## Schema/API/event changes

None. No Prisma schema, API route, repository, domain event, outbox event, import job, or export job was added.

## Security/privacy impact

Positive UI-level hardening:

- List-safe DTO has no `tenantId`, contacts, hashes, token material, or audit fields.
- Raw/synthetic personalized links remain local fixture state and are not sent to telemetry.
- Contact values are masked in detail and omitted from list rows.
- Export action states that production export must be tenant-scoped and audited.
- Duplicate handling remains advisory and never silently merges.
- No guest names, contact values, raw links, token hashes, or CSV payloads are logged.

Remaining security blocker:

- There is no live authentication, authorization, tenant resolver, guest repository, import job, export job, or database ownership test in the current backend.

## Validation

Passed:

```text
npm run typecheck -w @wedding/customer-web
npm run test -w @wedding/customer-web
npm run build -w @wedding/customer-web
npm run test:integration -- tests/integration/guest-tenant-isolation.integration.test.ts
git diff --check
```

Results:

- Customer-web typecheck passed.
- Customer-web tests passed: 18 files, 128 tests.
- Customer-web production build passed; guest routes compiled:
  - `/tamu`
  - `/tamu/[householdId]`
  - `/tamu/baru`
  - `/tamu/impor`
- Tenant contract suite passed: 2 assertions, 1 explicit todo for live repository isolation.
- Diff whitespace check passed; Git reported only existing line-ending warnings.
- Scoped ESLint reported 0 code errors. It emitted the repository's existing Pages-directory warning and ignored CSS-file warning; no guest TypeScript/TSX lint errors were reported.
- Project diagnostics still contain unrelated pre-existing errors in marketing/templates/public-invitation/API documentation files; no diagnostics remain in the changed guest files.

## Tests added

- `apps/customer-web/src/lib/guests/contract.test.ts`
  - query parsing/filter behavior
  - privacy-safe list DTO rejection
  - CSV valid/invalid/duplicate classification
  - token-disabled list/detail consistency
- `apps/customer-web/src/components/guests/guest-import-wizard.test.tsx`
  - explicit duplicate opt-in before import confirmation
- `apps/customer-web/src/lib/guests/pii.test.ts`
  - diagnostic payload scrubbing
- `tests/integration/guest-tenant-isolation.integration.test.ts`
  - tenant/wedding resource-key separation
  - household ownership guard
  - explicit todo for Tenant A/B live repository tests

## Unresolved risks and blockers

1. Live guest data must not be connected to the fixture transport.
2. `GuestEventAccess`, `Tag`, household-tag relations, import-job persistence, and export-job persistence are missing from the current schema.
3. Backend API currently does not expose `/guests`, `/guest-imports`, `/guest-links`, or `/guest-exports`.
4. Production Tenant A/B and household A/B tests remain required before live integration.
5. Production link rotation must return a one-time opaque token from an authorized server mutation and persist only its hash.
6. Production export must be permission-controlled, tenant-scoped, asynchronous where needed, and audit-recorded.
7. The UI uses fixture timers for processing states; these must be replaced by job polling/subscription state in production.

## Approval and next action

- UI fixture work: ready for conditional review.
- Live guest integration: blocked pending Security/Tenancy, Backend, Database, and Guest Domain approval.
- Next action: design and implement the authorized guest application/API boundary, tenant-scoped repositories, missing schema relations/job records, audit/outbox behavior, and live Tenant A/B integration tests before replacing the fixture transport.

## Rollback notes

To roll back this task's focused changes, remove the new export, privacy, guest regression, and tenant contract files and revert the corresponding guest component/fixture/style edits. Do not revert unrelated pre-existing workspace changes listed by `git status`.
