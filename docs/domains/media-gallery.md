# Domain: Media Gallery

## Purpose
Wedding photos/video references.

## Actors
couple, guest.

## Entities
MediaAsset, Gallery, GalleryItem.

## Business rules
signed upload, scan, process, quota.

## Status and transitions
PENDING → UPLOADED → PROCESSING → READY/REJECTED → DELETED.

## Use cases
upload, order, caption, remove.

## Validation
MIME/magic bytes/size/dimensions.

## Edge cases
orphan, malicious file, failed derivative.

## API
/uploads, /media, /galleries.

## Domain events
MediaReady, MediaRejected.

## Dependencies
storage, worker.

## Security considerations
private originals and signed access.

## Owning module
`media` owns the invariant and write model. Other modules integrate through application ports or versioned events.
