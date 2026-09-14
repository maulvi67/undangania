# MVP-UI-007 Customer Dashboard Handoff

Status: IMPLEMENTED — development validation complete

## Scope

Implemented the approved customer dashboard for Wedding System. The route is
`/dashboard` and is a server-rendered, decision-oriented workspace overview.

Primary job:

- tell the customer what must be completed next;
- provide fast access to invitation, guests, RSVP, guestbook, and orders;
- show lifecycle, payment, expiry, and partial-service states without invented
  metrics or decorative dashboard clutter.

## Requirement and decision coverage

- Task: `.ai/tasks/MVP-UI-007-CUSTOMER-DASHBOARD.md`
- Approved plan: `.ai/handoffs/MVP-UI-007-DESIGN-PLAN.md`
- Related auth decision: MVP-UI-005 D3 completed; default post-auth redirect is
  now `/dashboard`.
- Approved decisions implemented: D1–D9 from the dashboard design plan.
- Standing testing direction followed: unit tests, typecheck, build, scoped
  lint, and runtime smoke; no Playwright suites added.

## What changed

### Dashboard UI

- Added `/dashboard` route with `robots: { index: false }` and dynamic rendering.
- Added responsive dashboard composition:
  - workspace heading and couple/city context;
  - timezone-aware countdown band;
  - payment and expiry alerts;
  - prioritized `Langkah berikutnya` action block;
  - invitation lifecycle/status and active-period explanation;
  - explainable five-item completion progress;
  - count-only RSVP summary;
  - count-only guest summary;
  - support link to `/#faq`;
  - loading skeleton and whole-page unauthenticated/provider-unavailable
    states.
- Preserved the Wedding System visual direction: ivory background, paper
  surfaces, ink text, olive action, serif display type, hairline borders, and
  soft shadows. No gradients, charts, decorative card wall, or new motion.
- Used `ApplicationShell` for desktop navigation and mobile drawer.
- Role-gated `Pesanan` navigation and payment action to `OWNER`; `EDITOR`
  receives an explanatory payment notice without a billing CTA.
- Added reduced-motion handling for dashboard loading skeletons.

### Dashboard contract and simulation transport

- Added validated aggregate DTO and derivations in
  `apps/customer-web/src/lib/dashboard/contract.ts`:
  - lifecycle and payment overlay state derivation;
  - ranked/max-three actions;
  - active period = event date + 30 days;
  - expiring-soon = 14 or fewer days remaining;
  - UTC-anchored wall-date countdown;
  - Indonesian date/number formatting;
  - completion calculation;
  - section availability and expiry helpers.
- Added explicit simulation-only fixture transport in
  `apps/customer-web/src/lib/dashboard/stub-transport.ts`.
- Removed the invalid module-level `use server` directive from the fixture
  transport because synchronous fixture exports are not valid Server Actions.

### Auth redirect integration

- Changed `DEFAULT_REDIRECT` from `/` to `/dashboard`.
- Added `/dashboard` to the safe post-auth destination allowlist.
- Preserved query parameters while rejecting open-redirect, encoded-host,
  backslash, control-character, and non-allowlisted targets.
- Added explicit redirect coverage for `/dashboard` and its fixture query.

## Exact files

Modified:

- `apps/customer-web/src/lib/auth/redirect.ts`
- `apps/customer-web/src/lib/auth/redirect.test.ts`

Added:

- `apps/customer-web/src/app/dashboard/page.tsx`
- `apps/customer-web/src/app/dashboard/loading.tsx`
- `apps/customer-web/src/app/dashboard.css`
- `apps/customer-web/src/components/dashboard/countdown-band.tsx`
- `apps/customer-web/src/components/dashboard/next-actions.tsx`
- `apps/customer-web/src/components/dashboard/invitation-status.tsx`
- `apps/customer-web/src/components/dashboard/completion-progress.tsx`
- `apps/customer-web/src/components/dashboard/rsvp-summary.tsx`
- `apps/customer-web/src/components/dashboard/guest-summary.tsx`
- `apps/customer-web/src/components/dashboard/dashboard-view.tsx`
- `apps/customer-web/src/lib/dashboard/contract.ts`
- `apps/customer-web/src/lib/dashboard/contract.test.ts`
- `apps/customer-web/src/lib/dashboard/stub-transport.ts`

The repository also contains uncommitted MVP-UI-006 onboarding work from the
prior task; it was not reverted or modified as part of this dashboard task.

## Architecture impact

- The page remains a Next.js Server Component.
- There is one server-side dashboard load per request and no client fetch or
  dashboard-specific client state.
- The aggregate contract is the intended handoff boundary for a future real
  dashboard API.
- The fixture provider is intentionally isolated from UI components.
- Existing `@wedding/ui` components/tokens are reused; no package dependency or
  design-system API changes were required.
- `/editor`, `/tamu`, `/rsvp`, `/buku-tamu`, and `/pesanan` remain accepted
  contract-target routes until their respective MVP tasks implement them.

## Schema/API changes

No database schema or production API changes were made.

The new `DashboardAggregate` Zod contract describes the future read model:

- workspace context;
- invitation lifecycle;
- payment state;
- guest counts;
- RSVP counts;
- per-section availability.

## Security and privacy impact

- The current transport is clearly marked `SIMULATION ONLY`; it has no session,
  tenant, authorization, persistence, or payment-provider integration.
- Guest and RSVP screens expose counts only on the dashboard; no names,
  contacts, or guest PII are rendered.
- `?state=` is allowlisted server-side and invalid values silently fall back to
  the default fixture.
- Dashboard metadata is noindex because it is a private workspace surface.
- Payment state is fixture data only. Production payment state must come from
  verified server-to-server provider state/reconciliation.
- Before production use, replace `stub-transport.ts` with a tenant-scoped,
  session-authorized aggregate repository/API. Do not expose fixture switching
  in production.

## Validation evidence

Passed:

- `npx prettier --check ...` for dashboard, contract, and redirect files.
- `npm run typecheck -w @wedding/customer-web`
- `npm test -w @wedding/customer-web`
  - 7 test files passed
  - 97 tests passed
- Scoped ESLint from `apps/customer-web` for dashboard and redirect files.
- `npm run build -w @wedding/customer-web`
  - production build passed;
  - `/dashboard` reported as dynamic server-rendered route.
- Production runtime smoke with `next start`:
  - `/dashboard`
  - `?state=draf`
  - `?state=siap`
  - `?state=aktif`
  - `?state=jeda`
  - `?state=segera-berakhir`
  - `?state=berakhir`
  - `?state=menunggu-pembayaran`
  - `?state=peninjau`
  - `?state=belum-masuk`
  - `?state=gangguan`
  - `?state=ringkasan-gagal`
  - all returned HTTP 200;
  - marker checks confirmed the default dashboard, unauthenticated,
    unavailable, and partial-failure copy.

Not run by standing instruction:

- Playwright suites.
- Browser-based accessibility/responsive/performance audits.
- Next.js DevTools inspection.

These remain release-QA work for the eventual real provider integration and
were intentionally not added to the development pass per the user's testing
instruction.

## Migration and rollback

- No migration required.
- Rollback is file-level: remove the dashboard route/components/contract and
  revert the two auth redirect changes, or restore the previous revision.
- Do not roll back by deleting the aggregate contract if another task has
  adopted it as an API handoff; coordinate with the domain/API owner.

## Known risks and follow-up

1. The page is fixture-backed and must not be treated as production-ready
   tenant data. Replace the provider before enabling real customers.
2. The contract-target navigation routes may 404 until the corresponding
   customer workspace tasks land. This is intentional and documented in the
   approved plan.
3. The current application shell uses anchor navigation as provided by the
   existing design-system component; no shell API changes were made.
4. Browser-level keyboard, responsive, reduced-motion, console, network,
   accessibility, and performance evidence still needs to be collected by the
   consolidated UI quality gate when that workflow is resumed.

## Next action

Implement the tenant-scoped dashboard aggregate repository/API with session and
role authorization, verified payment state, and bounded aggregate queries;
then rerun the browser UI quality gates against the real data provider.
