# Domain: Invitation Template

## Purpose
Commercial template catalog.

## Actors
designer, customer, admin.

## Entities
Template, TemplateVersion, TemplateLicense.

## Business rules
only approved/licensed versions; immutable version.

## Status and transitions
DRAFT → REVIEW → APPROVED → ACTIVE → RETIRED.

## Use cases
submit, review, price, activate, retire.

## Validation
manifest, schema, license, asset checks.

## Edge cases
retired version still used by publication.

## API
/templates, /template-versions.

## Domain events
TemplateApproved, TemplateRetired.

## Dependencies
template engine, catalog.

## Security considerations
supply-chain and intellectual-property controls.

## Owning module
`template` owns the invariant and write model. Other modules integrate through application ports or versioned events.
