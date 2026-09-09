# Domain: Template Customization

## Purpose
Safe configurable appearance/content.

## Actors
customer, designer.

## Entities
TemplateCustomization, ThemeToken, SectionConfig.

## Business rules
no arbitrary JS; validated tokens only.

## Status and transitions
DRAFT → VALID → PUBLISHED.

## Use cases
change colors/fonts/visibility/order.

## Validation
allowlist tokens, section compatibility.

## Edge cases
long content, unsupported section, old version.

## API
/customizations, /preview.

## Domain events
CustomizationChanged.

## Dependencies
template, invitation.

## Security considerations
prevent XSS/CSS injection.

## Owning module
`template-editor` owns the invariant and write model. Other modules integrate through application ports or versioned events.
