# MVP-UI-013 Handoff — Admin Operations Dashboard

- **Task ID:** MVP-UI-013-ADMIN
- **Status:** Implemented, read-only fixture phase
- **Objective:** Provide an operationally dense admin console for triaging payments, jobs, publications, printing, support, templates, lifecycle exceptions, and audit access without exposing unnecessary customer data.
- **Approval:** User approved the implementation plan before coding.

## Context read

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `CODEBASE_MAP.md`
- `.ai/tasks/MVP-UI-013-ADMIN.md`
- `docs/security/authorization-matrix.md`
- `docs/security/data-classification.md`
- `docs/security/threat-model.md`
- `docs/domains/order.md`
- `docs/domains/payment.md`
- `docs/domains/printing-order.md`
- `docs/domains/invitation-template.md`
- `docs/domains/template-customization.md`
- `docs/domains/audit-log.md`
- `docs/domains/moderation.md`
- `docs/api/openapi.yaml`
- `docs/api/event-catalog.md`
- `docs/api/error-catalog.md`
- `docs/architecture/container-diagram.md`
- `docs/architecture/component-diagram.md`
- `docs/testing/test-strategy.md`
- `docs/testing/definition-of-done.md`
- Shared components in `packages/ui/src`
- Existing customer dashboard contract/fixture patterns

## Decisions

- Implemented a server-rendered dashboard using a typed, Zod-validated fixture transport.
- Fixture mode is explicitly labeled `Local · data simulasi` and each dashboard includes a simulation warning.
- The UI is read-only. Privileged actions are represented as unavailable and are not wired to client mutations.
- QRIS/Midtrans presentation is provider-status aware; browser redirects are explicitly not treated as payment truth.
- Payment, customer, workspace, audit, and diagnostic values are masked or reduced by default.
- Publication failures distinguish attempted snapshot versions from the currently active public snapshot.
- Tables become stacked labeled records on narrow screens instead of forcing a wide table into the viewport.
- No database, API, authentication provider, payment provider, or production infrastructure changes were made.

## Files changed

- `apps/admin-dashboard/package.json`
- `apps/admin-dashboard/next-env.d.ts` (generated Next.js route-type path update)
- `apps/admin-dashboard/src/app/layout.tsx`
- `apps/admin-dashboard/src/app/page.tsx`
- `apps/admin-dashboard/src/app/error.tsx`
- `apps/admin-dashboard/src/app/loading.tsx`
- `apps/admin-dashboard/src/app/admin.css`
- `apps/admin-dashboard/src/components/admin/admin-dashboard.tsx`
- `apps/admin-dashboard/src/components/admin/admin-header.tsx`
- `apps/admin-dashboard/src/components/admin/admin-shell.tsx`
- `apps/admin-dashboard/src/components/admin/admin-sidebar.tsx`
- `apps/admin-dashboard/src/components/admin/attention-queue.tsx`
- `apps/admin-dashboard/src/components/admin/audit-access.tsx`
- `apps/admin-dashboard/src/components/admin/failed-jobs.tsx`
- `apps/admin-dashboard/src/components/admin/lifecycle-exceptions.tsx`
- `apps/admin-dashboard/src/components/admin/masked-value.tsx`
- `apps/admin-dashboard/src/components/admin/operations-table.tsx`
- `apps/admin-dashboard/src/components/admin/payment-reconciliation.tsx`
- `apps/admin-dashboard/src/components/admin/printing-status.tsx`
- `apps/admin-dashboard/src/components/admin/publication-failures.tsx`
- `apps/admin-dashboard/src/components/admin/section-state.tsx`
- `apps/admin-dashboard/src/components/admin/support-cases.tsx`
- `apps/admin-dashboard/src/components/admin/template-status.tsx`
- `apps/admin-dashboard/src/lib/admin/contract.ts`
- `apps/admin-dashboard/src/lib/admin/fixture-transport.ts`
- `apps/admin-dashboard/src/lib/admin/formatters.ts`
- `apps/admin-dashboard/src/lib/admin/contract.test.ts`
- `package-lock.json`

## Architecture impact

The admin page is now a typed presentation boundary over a local simulation transport. Route components do not access Prisma or business repositories. The intended future production path remains:

`admin route → authorized application use case → admin read repository → masked operational DTO`.

No schema, event, or production API changes were made.

## Security/privacy impact

- No raw provider payloads, payment secrets, provider credentials, stack traces, tokens, or unmasked contact data are rendered.
- Sensitive operations remain unavailable until server authorization, MFA/step-up, reason capture, confirmation, transactions where needed, and audit events exist.
- Fixture query values are allowlisted and do not provide production access.
- No impersonation, broad customer browsing, export, audit reveal, payment mutation, retry, support mutation, or template availability mutation is implemented.
- This phase must not be deployed as a production admin surface without authentication and authorization integration.

## Tests and results

Passed:

- `npm run typecheck -w @wedding/admin-dashboard`
- `npm run lint -w @wedding/admin-dashboard`
- `npm test -w @wedding/admin-dashboard` — 4 tests passed
- `npm run build -w @wedding/admin-dashboard`

The first typecheck/lint pass found and fixed readonly fixture inference, one unused import, and one Next.js anchor rule violation.

Not run in this implementation handoff:

- Browser/UI quality audits.
- Next.js DevTools runtime inspection.
- Chromium/Firefox/WebKit review.
- Accessibility, responsive, and performance specialist skills.

Those should be run after the development phase according to the project workflow.

## Migration and rollback

- No database migration.
- No API migration.
- Rollback is limited to removing the additive admin UI, fixture transport, UI dependency, and handoff. No operational records are mutated.
- `package-lock.json` was updated through `npm install --package-lock-only --ignore-scripts`; it includes the intended `@wedding/ui` admin workspace link and synchronized pre-existing customer workspace dependency links.

## Known risks and blockers

1. The fixture transport is not an authentication or authorization boundary.
2. There is no admin backend read contract yet.
3. Disabled action labels are visual guardrails only; production authorization must be server-enforced.
4. `UnavailableView` action buttons are intentionally non-mutating placeholders and should become approved navigation/re-authentication flows in a future task.
5. The admin app has not yet had browser-based accessibility/responsive/performance gates run.

## Required reviewers

- Admin/Operations owner
- Security
- Finance/Payment
- Backend
- UI/UX
- Accessibility
- QA
- Human approver for privileged actions

## Precise next action

Create a separate backend/admin-contract task for authenticated, server-authorized, paginated operational read models. Define role-scoped DTOs and permission checks before enabling any reconciliation, retry, template status mutation, support mutation, audit reveal/export, or customer-data access.

## Build and browser validation follow-up — 2026-09-29

- Root cause: `package-lock.json` had metadata-less placeholders for all 11 `lightningcss@1.30.2` optional platform binaries. Added the matching package versions, canonical npm tarball URLs, SHA-512 integrity values, and platform constraints. No direct dependency or version upgrade was added.
- `npm run build -w @wedding/admin-dashboard` passed after staging the exact Windows x64 `1.30.2` package locally and clearing stale `.next` output. The registry mirror served package metadata, but its tarball transfer timed out; clean npm reification from the updated lockfile remains unverified. No `1.32.0` binary was used.
- Typecheck, lint, and 15 unit tests passed. A local Chromium fixture smoke found no horizontal overflow at 320, 360, 375, 390, 412, 768, 1024, 1280, or 1440px; axe WCAG 2.1 A/AA reported 0 violations. Mobile/desktop screenshots were saved under the local temp directory `C:\Users\MAULVIA\AppData\Local\Temp\wedding-system-admin-dashboard` and were not committed.
- Next dev HMR WebSocket handshakes failed, making shortcut/theme interaction checks inconclusive. Manual keyboard, 200% zoom/reflow, exceptional-state, cross-browser, and full screenshot review remain pending. Existing accessibility/responsive Playwright specs do not cover admin, and the root package has no `test:responsive` script.
- No API, schema, database, authentication, authorization, or payment behavior changed.
