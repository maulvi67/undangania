# MVP Gap Readiness

## Scope

This handoff records the MVP feature gaps closed after the production-blocker
work. It does not activate providers, deploy infrastructure, or apply migrations.

## Implemented

- **Invitation lifecycle**: the editor can pause and reactivate an invitation
  without discarding its immutable snapshot. Reactivation requires an active
  entitlement; pausing does not.
- **Guest organization**: households now store free-form tags and an explicit
  event-access set. Create, edit, CSV import, list filters, export, and the
  personalized guest context use the stored selection. A crafted event id from
  another wedding is rejected before any write.
- **Guest deletion**: deleting a household is a soft delete. The personalized
  link stops resolving while RSVP and guestbook history remain.
- **RSVP oversight**: the couple can override an answer with a pax check. Each
  override writes `RsvpHistory`, bumps the optimistic version, and records
  `RSVP_OVERRIDDEN` in the audit log. CSV export records `RSVP_EXPORTED`.
- **Guestbook moderation**: `DELETED` is now a moderation status. A deleted
  message is no longer eligible for public rendering.
- **Notification status**: `/notifikasi` shows tenant-scoped delivery state for
  transactional email without recipient references, provider message ids,
  idempotency keys, or raw provider errors.

## Files and requirement areas

- `packages/application/src/editor.ts`: pause/reactivate use case.
- `packages/database/src/repositories/invitation-editor.ts`: snapshot
  deactivation and promotion.
- `packages/database/prisma/schema.prisma` and
  `packages/database/prisma/migrations/20261019100000_guest_tags_event_access/`:
  guest tags and `GuestEventAccess`.
- `packages/database/src/repositories/guest-roster.ts`: tags, event access,
  soft delete, import propagation, and per-household export labels.
- `packages/database/src/repositories/oversight.ts`: RSVP override/export and
  guestbook delete.
- `packages/database/src/repositories/notification-status.ts`: privacy-safe
  notification reads.
- Customer web editor, guest, RSVP, guestbook, dashboard, and notification
  surfaces.

## Schema and migration

- Additive migration only. It adds `GuestHousehold.tags` and the
  `GuestEventAccess` table with cascade foreign keys.
- `NOT APPLIED`. Staging/production requires database-owner approval and a
  verified backup.
- Rollback: deploy the previous application bundle. The added table and column
  are backward-compatible with the previous code.

## Security and privacy

- Every new read and write resolves tenant and wedding from the session.
- Event access ids are validated against the owning wedding before insertion.
- RSVP override and export write audit rows; override also preserves history.
- Guest deletion is soft and keeps historical RSVP/guestbook rows.
- Notification status excludes recipient references, provider ids, and raw
  errors.
- No new secret, provider activation, payment mutation, or DNS change was added.

## Validation evidence

- `npx turbo run typecheck --force` — 19/19 successful.
- `npm test` — 31/31 turbo tasks successful; database 422 tests, customer web
  264 tests, application 121 tests, notification relay 37 tests.
- `npm run build` — 19/19 successful; `/notifikasi` appears in the customer route
  manifest.
- `npm run validate:repo` — passed.
- Prisma schema validation with dummy local URLs — passed.
- Lint on customer web, database, and application — no errors; customer web
  retains two pre-existing warnings.

## Remaining decisions and known risks

- Public invitation view analytics is not emitted. The current analytics
  contract requires an authenticated tenant member and explicit consent, so
  recording a guest page view needs a Product/Privacy decision rather than an
  implementation shortcut.
- Order cancellation is not exposed. Cancelling after a provider transaction
  exists can conflict with payment truth and needs Payment/Security approval.
- Member invitation, role changes, and session revocation from the customer UI
  remain identity work requiring role and audit approval.
- Subscription, custom domain, reseller, automated WhatsApp, vendor marketplace,
  advanced AI, and printing fulfillment remain feature-flagged post-MVP scope.
- The new migration and the existing checkout-idempotency migration are not
  applied to any environment.

## Next action

1. Approve and rehearse the additive guest migration in staging.
2. Run the purchase → publish → pause → reactivate → guest access → RSVP
   override/export journey against approved staging data.
3. Decide the public analytics consent model before emitting invitation views.
