# P2 Production Readiness Handoff

## Scope and decision

This handoff records the selected P2 scope: **P2-MEDIA-STATUS-001 — asynchronous media status reconciliation in the customer editor**.

No formal P2 backlog was present in the repository. The scope was selected from the P1 media follow-up because the application now correctly stops upload completion at `UPLOADED`, while the editor previously had no reliable way to observe the worker's later `SCANNING → PROCESSING → READY` transition without a page refresh.

The implementation is limited to safe read/reconciliation behavior. It does not activate providers, change authentication, alter payment, add production infrastructure, add a scheduler, or apply a database migration.

## Implemented

- Added `listMediaAssetsAction`, a server action that reads the current session workspace's media lifecycle states.
- Kept the read path tenant- and wedding-scoped through `resolveSessionWorkspaceOrNull`, `listMediaAssets`, and the media repository.
- Added a pure reconciliation contract for applying persisted state and processed dimensions to the editor draft.
- Added bounded polling in the real customer editor:
  - immediately after editor load when a non-terminal media state exists;
  - every 3 seconds;
  - at most 20 attempts;
  - stopped on `READY`, `REJECTED`, `DELETED`, unmount, or exhausted attempts.
- Preserved locally entered alt text and local rejection copy when the current database schema cannot return those values.
- Added explicit status copy distinguishing `UPLOADED` (waiting for inspection) from `READY` (usable).
- Added a non-blocking warning when status refresh is unavailable; the UI never fabricates a terminal state or asks the customer to upload again automatically.

## Files changed

- `apps/customer-web/src/lib/media/actions.ts`
- `apps/customer-web/src/lib/media/outcomes.ts`
- `apps/customer-web/src/lib/editor/media-reconciliation.ts`
- `apps/customer-web/src/lib/editor/media-reconciliation.test.ts`
- `apps/customer-web/src/components/editor/editor-shell.tsx`
- `apps/customer-web/src/components/editor/upload-state.tsx`
- `docs/domains/media-gallery.md`
- `docs/operations/runbooks.md`
- `docs/operations/p2-production-readiness.md`

## Architecture impact

The customer UI now consumes an existing application read use case through a server action. It does not access Prisma or storage directly. Reconciliation is deliberately pure and local to the editor contract so lifecycle updates cannot bypass the existing save/version boundary.

The polling effect updates the draft's media lifecycle metadata and allows the existing autosave flow to persist the observed state. The worker remains the only component allowed to advance an uploaded asset to `READY`.

## Schema and API impact

- Database schema: none.
- Migration: none.
- New external HTTP endpoint: none; `listMediaAssetsAction` is a server action used by the authenticated editor.
- Existing media list output is reused. No signed upload/read URL, object key, tenant ID, actor ID, or provider diagnostic is exposed to the browser through this change.

## Security and privacy

- The server action resolves the current session workspace and does not accept tenant ID, wedding ID, or asset IDs from the browser.
- The application use case authorizes editor roles and passes the resolved tenant/wedding scope to the repository.
- The repository excludes soft-deleted rows and lists only the exact tenant/wedding scope.
- Polling does not log media identifiers, tenant identifiers, actor identifiers, file contents, or URLs.
- Public readiness remains unchanged: only `READY` assets are eligible for signed public reads.
- Reconciliation never changes `DELETED` local state based on a stale list response.

## Tests and validation

Added unit coverage for:

- `UPLOADED → READY` reconciliation with dimensions;
- preserving deleted local state;
- unavailable list reads failing closed without changing the draft;
- pending-state detection and status priority.

Validation to run for this handoff:

- `npm run typecheck -w @wedding/customer-web`
- `npm run lint -w @wedding/customer-web`
- `npm test -w @wedding/customer-web -- --run src/lib/editor/media-contract.test.ts src/lib/editor/contract.test.ts src/lib/editor/media-reconciliation.test.ts`
- `npx prettier --check` for all changed P2 files
- `git diff --check`

The customer-web lint baseline has two existing warnings unrelated to this scope: a raw `<img>` in the public Seruni template and an existing unused fixture destructuring variable.

## Migration and rollback

- Migration: none.
- Rollback: deploy the prior customer-web bundle. Existing upload and worker lifecycle behavior remains valid because this change only adds a read/reconciliation client path.
- If the list action or provider is unavailable, the editor warning is safe to leave enabled; it does not mark assets ready or delete data.
- Do not increase polling frequency or attempt destructive cleanup as part of rollback or incident response.

## Known risks and approvals

- The action still depends on the existing session workspace and database repository availability; it is intentionally not a substitute for a durable worker/outbox lease implementation.
- The current schema does not persist rejection reasons, so a refresh can show a generic rejection message after local state is lost. Persisting reasons remains an additive migration requiring database-owner approval.
- A production worker adapter and distributed operational observability remain P1/provider deployment work.
- Product/Operations approval for analytics rate policies and infrastructure approval for distributed adapters remain outstanding from P1.
- No new high-risk approval was required for this read-only UI reconciliation scope.

## Next action

Run the targeted validation above, then verify the complete lifecycle in approved staging with a real worker adapter: upload a valid image, observe `UPLOADED`, `SCANNING`, `PROCESSING`, and `READY`, and verify that a rejected/malware fixture never becomes public.
