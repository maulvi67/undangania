# Domain: Printing Order

## Purpose
Print production fulfillment.

## Actors
customer, vendor, operations.

## Entities
PrintingOrder, PrintItem, Proof, ProductionUpdate.

## Business rules
proof approval and vendor acceptance before production.

## Status and transitions
DRAFT → QUOTED → PAID → PROOF_PENDING → APPROVED → PRODUCTION → SHIPPED → COMPLETED.

## Use cases
quote, approve proof, produce, update.

## Validation
quantity, material, design version, address.

## Edge cases
reprint, rejected proof, vendor delay.

## API
/printing-orders, /proofs.

## Domain events
PrintOrderApproved, PrintOrderShipped.

## Dependencies
order, vendor, shipping, media.

## Security considerations
signed proof, address protection, audit.

## Owning module
`printing` owns the invariant and write model. Other modules integrate through application ports or versioned events.
