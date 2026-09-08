# Responsive QA Checklist

## Required fixtures
- [ ] Normal invitation data.
- [ ] Couple names at maximum supported length.
- [ ] Three or more events with long venue/address.
- [ ] Missing optional sections.
- [ ] Thirty-image gallery.
- [ ] Validation errors and provider failure states.
- [ ] Indonesian and English content.

## Mobile
- [ ] 320, 360, 375, 390, and 412 pixel widths tested.
- [ ] No document-level horizontal overflow.
- [ ] Navigation, primary CTA, form submit, preview, music, and RSVP remain reachable.
- [ ] Fixed/sticky UI respects safe areas and virtual keyboard.
- [ ] Input font sizing avoids unwanted mobile zoom.
- [ ] Tables and dense administration content use an intentional small-screen pattern.

## Tablet and desktop
- [ ] 768 portrait and 1024 landscape tested.
- [ ] 1280 and 1440 desktop tested.
- [ ] Content does not become excessively wide.
- [ ] Editor and preview preserve independent usability.
- [ ] Sidebars, dialogs, popovers, and dropdowns fit within viewport.

## Content and media
- [ ] Names, dates, currency, addresses, URLs, and email-like strings wrap safely.
- [ ] Images/video preserve aspect ratio and reserve space.
- [ ] Cropping does not remove important subject regions in approved assets.
- [ ] Slow/missing media has useful fallback.
- [ ] Font swap does not materially shift layout.

## Interaction and reflow
- [ ] Portrait/landscape transition works.
- [ ] Browser zoom 200% and text spacing do not break tasks.
- [ ] Focus is never hidden by sticky elements.
- [ ] Drag interactions have non-drag alternatives.
- [ ] Hover-only information has focus/touch equivalent.

## Evidence
- [ ] Screenshot set for required viewports attached.
- [ ] Playwright browser matrix passed.
- [ ] Overflow and console/network checks passed.
- [ ] Visual differences reviewed rather than blindly accepted.
