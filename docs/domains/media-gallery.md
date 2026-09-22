# Domain: Media Gallery

## Purpose
Wedding photos and audio references for private customer workspaces and public invitation galleries.

## Actors
Couple, editor, guest.

## Entities
MediaAsset, Gallery, GalleryItem.

## Business rules
- Customer originals are private Cloudflare R2 objects.
- The browser receives a short-lived signed PUT URL only after the server validates the session workspace, MIME type, and size.
- The server creates the tenant- and wedding-scoped `MediaAsset` row before signing the upload.
- Completion reads provider metadata with `HeadObject`; declared and observed content length/type must match before the asset can enter `UPLOADED`. Only the worker pipeline can advance a processed asset to `READY`.
- Only `READY` assets in the publication's tenant and wedding scope receive short-lived signed read URLs.
- Signed read URLs are render-time data and must never be persisted in publication snapshots or audit metadata.
- Database deletion is a soft delete; object deletion is retried safely because R2 deletion is idempotent.

## Status and transitions
`PENDING_UPLOAD → UPLOADED → SCANNING → PROCESSING → READY`. An uploaded object is not publicly usable until the worker has passed magic-byte inspection, dimensions, malware verdict, and derivative generation. Inspection/scanner/provider failures are retryable; invalid signatures, dimensions, malware, and derivative policy failures reject the asset.

## Use cases
Upload, verify, list, caption, remove, public read resolution.

## Validation
MIME allowlist, size limits, server-observed object metadata, tenant/wedding scope, and safe server-generated object keys are enforced before processing. The application now provides a bounded content inspector contract: a storage adapter reads at most 64 KiB from a tenant-scoped object range, verifies the declared magic signature, and extracts JPEG/PNG/WebP dimensions without loading the original into the application. The provider-neutral worker contract still requires malware scanning and derivative generation before `READY`; those provider adapters remain deployment-specific and are not activated by this repository change.

## Edge cases
Orphaned pending rows, failed signed uploads, provider metadata mismatch, missing/deleted assets, signed URL failure, and cross-tenant/cross-wedding asset IDs.

## API / application actions
- `beginMediaUploadAction`: validates metadata and returns a short-lived signed upload URL.
- Browser `PUT`: sends the original directly to R2; application credentials never reach the browser.
- `completeMediaUploadAction`: verifies R2 `HeadObject` metadata, records `UPLOADED`, and returns the server state. It does not mark an asset `READY`.
- `listMediaAssetsAction`: returns the session workspace's current lifecycle states for editor reconciliation; it never returns signed URLs or assets outside the tenant/wedding scope.
- `removeMediaAssetAction`: soft-deletes the scoped row and removes the private object.
- Public invitation rendering resolves `READY` asset IDs into short-lived signed GET URLs.

## Environment
Use these existing environment names in each isolated environment:

```text
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

Keep the R2 bucket private. Configure bucket CORS to allow browser `PUT` requests only from the deployed customer-web origins, with `Content-Type` and `Content-Length` as needed. Do not commit credentials.

## Operations
- Run an orphan cleanup job for stale `PENDING_UPLOAD`/`UPLOADED` rows and their objects.
- Keep upload URLs around 15 minutes or less and public read URLs around 5 minutes.
- Alert on repeated `ProviderUnavailable` outcomes and outbox events stuck in `PENDING`.
- A worker consumes the versioned media-processing job through application ports. The application exports a bounded content inspector that can be backed by `R2StorageAdapter.readPrefix`; provider configuration must still supply malware scanner and derivative writer adapters. Range requests must return `206 Partial Content`; failures are retried without marking the asset `READY`.
- The editor reconciles persisted lifecycle states with a bounded three-second polling loop while an asset is `PENDING_UPLOAD`, `UPLOADED`, `SCANNING`, or `PROCESSING`. The loop stops at `READY`, `REJECTED`, `DELETED`, after 20 attempts, or when the editor unmounts.
- Cleanup currently exposes a bounded dry-run candidate interface only. Destructive object/row cleanup requires data-retention and database-owner approval plus a scheduled, audited implementation.

## Migration and rollback
No migration is required: `MediaAsset` and `MediaState` already exist in the Prisma schema. Roll back by disabling the media action/provider configuration and restoring the previous editor UI; existing private objects remain inaccessible without signed URLs. Do not delete rows or objects as part of an application rollback.

## Domain events
`MediaUploadStarted`, `MediaUploaded`, `MediaReady`, `MediaRejected`, and `MediaDeleted` are written to the audit/outbox boundary for worker and operational follow-up.

## Owning module
`media` owns the invariant and write model. Other modules integrate through application ports or versioned events.
