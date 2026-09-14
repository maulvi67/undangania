# MVP-UI-011 RSVP and Guestbook Handoff

## Status

**Conditional approval for fixture-backed guest experience; production RSVP/guestbook remains blocked.**

## Scope implemented

- Per-event household RSVP cards with Hadir, Masih tentatif, and Tidak dapat hadir.
- Server-contract-shaped client boundary for pax, optimistic versions, idempotency, stale updates, rate limit, and recoverable failures.
- Existing responses and update path.
- Deadline warning, locked, paused, expired, invalid-token, rate-limited, and provider-unavailable UI states.
- Optional moderated guestbook form with plain-text validation, 500-character limit, pending moderation copy, preserved input on recoverable errors, and XSS-safe rendering boundary.
- Explicit development-only `guestFixture` query gate; ordinary public invitation does not render personalized context.
- Responsive and reduced-motion styling for the Seruni visual system.

## Files changed

New:

- `apps/customer-web/src/lib/public-invitation/guest-context.ts`
- `apps/customer-web/src/lib/public-invitation/guest-context-fixtures.ts`
- `apps/customer-web/src/lib/public-invitation/guest-context-fixtures.test.ts`
- `apps/customer-web/src/lib/rsvp/contract.ts`
- `apps/customer-web/src/lib/rsvp/stub-transport.ts`
- `apps/customer-web/src/lib/rsvp/contract.test.ts`
- `apps/customer-web/src/lib/guestbook/contract.ts`
- `apps/customer-web/src/lib/guestbook/stub-transport.ts`
- `apps/customer-web/src/lib/guestbook/contract.test.ts`
- `apps/customer-web/src/components/public-invitation/guest-access-state.tsx`
- `apps/customer-web/src/components/public-invitation/guest-rsvp.tsx`
- `apps/customer-web/src/components/public-invitation/guest-rsvp-event-card.tsx`
- `apps/customer-web/src/components/public-invitation/guestbook-form.tsx`
- `apps/customer-web/src/components/public-invitation/guest-invitation-experience.tsx`

Updated:

- `apps/customer-web/src/app/invite/[slug]/page.tsx`
- `apps/customer-web/src/app/golden-invitation.css`
- `apps/customer-web/src/components/public-invitation/seruni-template.tsx`

## Architecture and security impact

- No backend route, repository, database migration, token resolver, tenant authorization, audit/outbox path, or moderation provider was added.
- Fixture transports are explicitly non-persistent and non-authoritative.
- Private guest context is separate from the immutable publication snapshot.
- No raw token, tenant identifier, contact data, guestbook message, or guest response is sent to telemetry by this UI.
- Production replacement requires opaque token hashing, tenant/wedding/household authorization, server-side pax/deadline enforcement, idempotency persistence, transactions, rate limiting, moderation, and Guest A/B integration tests.

## Development fixture URLs

Use the ordinary invitation plus a development-only query parameter:

```text
/invite/rani-bima?guestFixture=normal
/invite/rani-bima?guestFixture=already-responded
/invite/rani-bima?guestFixture=deadline-approaching
/invite/rani-bima?guestFixture=locked
/invite/rani-bima?guestFixture=paused
/invite/rani-bima?guestFixture=expired
/invite/rani-bima?guestFixture=invalid-token
/invite/rani-bima?guestFixture=submission-failed
/invite/rani-bima?guestFixture=stale
/invite/rani-bima?guestFixture=guestbook-rejected
/invite/rani-bima?guestFixture=guestbook-rate-limited
```

## Validation status

### Automated application checks

Passed sequentially:

- `npm run test -w @wedding/customer-web -- --reporter=dot`
  - 21 test files passed.
  - 137 tests passed.
- `npm run typecheck -w @wedding/customer-web`
- `npm run build -w @wedding/customer-web`
- `git diff --check`
- `npx prettier --check` for the changed RSVP, guestbook, public-invitation, and handoff files.

Focused lint reported no code errors. The remaining output is limited to pre-existing/non-actionable configuration warnings about the missing Pages directory and ignored CSS without a matching ESLint configuration.

### Browser, responsive, and accessibility checks

The handoff audit was run against the local application at `http://localhost:3000` with Chromium, Firefox, and WebKit at 320, 375, 390, 768, 1024, and 1440 pixel widths.

Verified:

- No horizontal overflow at the required widths.
- No console errors or failed network requests.
- Keyboard opening of the native invitation disclosure control.
- Validation-error focus moves to the error summary.
- Successful RSVP submission and guestbook submission.
- Guestbook script-like input stays plain text and does not execute.
- RSVP input is preserved after a recoverable failure.
- Stale-version handling is exposed.
- Locked controls are disabled.
- Paused, expired, invalid-token, rate-limited, and provider-unavailable states do not expose event cards or the guest greeting.
- Reduced-motion styling is applied.
- The ordinary invitation URL does not expose fixture guest context.
- The legacy public RSVP anchor remains available.
- Axe scan returned `[]` violations after fixing duplicate landmarks and the missing level-one heading.

Axe results are not a substitute for a full assistive-technology review.

### Built-runtime performance audit

The production build was served with `next start` on port 3001 and measured at a 390 pixel viewport by `.ai/handoffs/MVP-UI-011/performance.mjs`. Results are stored in `.ai/handoffs/MVP-UI-011/performance-results.json`.

| Route                | Wall-clock navigation |                          LCP sample | CLS | JS transfer | CSS transfer | Requests | Result                        |
| -------------------- | --------------------: | ----------------------------------: | --: | ----------: | -----------: | -------: | ----------------------------- |
| Public invitation    |                588 ms | Not emitted by the browser observer |   0 |   144,890 B |      8,095 B |       10 | Bundle/layout evidence only   |
| Guest fixture        |              9,697 ms |                              172 ms |   0 |   146,752 B |      8,095 B |       13 | Within lab bundle/CLS budgets |
| Long-content fixture |                698 ms |                              116 ms |   0 |   146,752 B |      8,095 B |       13 | Within lab bundle/CLS budgets |

The largest observed resource was 71,928 B. All audited routes had zero console errors, zero failed requests, and zero horizontal overflow. JavaScript remained below the 170 KB compressed lab target and CSS remained below the 70 KB target.

The public route did not expose an LCP entry even after a one-second post-navigation settling window, so no public LCP pass is claimed. INP and field p75 data were not measured by this local audit; production approval still requires repeatable mobile-throttled LCP/INP measurement and field RUM. The guest wall-clock result is also not treated as a p75 metric.

### Evidence files

- `.ai/handoffs/MVP-UI-011/audit.mjs`
- `.ai/handoffs/MVP-UI-011/axe-details.mjs`
- `.ai/handoffs/MVP-UI-011/performance.mjs`
- `.ai/handoffs/MVP-UI-011/performance-results.json`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-320.png`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-375.png`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-768.png`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-1024.png`
- `.ai/handoffs/MVP-UI-011/screenshots/normal-1440.png`
- `.ai/handoffs/MVP-UI-011/screenshots/success-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/submission-failed-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/locked-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/production-public-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/production-guest-390.png`
- `.ai/handoffs/MVP-UI-011/screenshots/production-long-content-390.png`

## Architecture, schema, and migration impact

- No production route, repository, database schema, migration, token resolver, or provider integration was added.
- No rollback or data migration is required for this fixture-backed UI change.
- Production implementation remains a separate Backend/Database/Security/Tenancy task.

## Security and privacy impact

- The fixture boundary does not authenticate, authorize, persist, or query tenant data.
- The UI intentionally excludes tenant ID, raw token, token hash, contacts, and other household data from the fixture context.
- No guest response, pax count, guestbook message, token, tenant data, or contact data is sent to telemetry by this UI.
- Production must add opaque token hashing, tenant/wedding/household authorization, server-side pax and deadline enforcement, idempotency persistence, transactions, rate limiting, moderation, and Guest A/B integration tests before enabling real guest access.

## Known risks and next action

- The guest experience is fixture-backed only; it must not be presented as a production RSVP or guestbook integration.
- The public-route LCP observer result is missing and INP/field p75 are not available from this run.
- Repeat the performance audit with a stable mobile-throttled environment and field RUM before public performance sign-off.
- Resolve the existing RSVP deadline/schema and event-ID contract gaps before backend implementation.

## Decision

**CONDITIONAL APPROVAL for the fixture-backed guest RSVP and guestbook UI.** Responsive, keyboard, reduced-motion, accessibility scan, browser, application-test, build, and bundle/CLS checks are complete. The public LCP and INP evidence gaps remain release follow-ups.

Live production RSVP/guestbook integration is **BLOCKED** until Backend, Database, Security/Tenancy, RSVP/Guestbook Domain, Moderation, Accessibility, Performance, and QA reviewers approve the production boundary.
