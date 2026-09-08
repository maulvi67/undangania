# Accessibility QA Checklist

Target: WCAG 2.2 AA baseline, with strong focus appearance as an internal quality target.

## Structure and navigation
- [ ] Page has descriptive title and `lang`.
- [ ] Skip link reaches main content.
- [ ] Header, navigation, main, complementary, and footer landmarks are meaningful.
- [ ] One logical H1; headings do not skip based on visual styling alone.
- [ ] Link text is understandable from context.
- [ ] Breadcrumb/current page, when present, is announced.

## Keyboard and focus
- [ ] All actions work without mouse or touch.
- [ ] Tab order follows reading and task order.
- [ ] Focus indicator is clearly visible on every interactive component.
- [ ] Sticky headers/footers do not fully obscure focused elements.
- [ ] Dialog traps focus, supports Escape where appropriate, and returns focus to trigger.
- [ ] Menus, tabs, radio groups, comboboxes, and carousels follow expected keyboard patterns.
- [ ] No positive `tabindex`, keyboard trap, or hidden focus target.

## Forms and errors
- [ ] Every field has a programmatic label.
- [ ] Required/optional status is conveyed in text and semantics.
- [ ] Helper and error text are associated with the field.
- [ ] Validation does not rely only on color.
- [ ] Error summary links to invalid fields for long forms.
- [ ] User input remains after recoverable errors.
- [ ] Authentication supports password managers and paste.
- [ ] RSVP, checkout, gift, and guest-import forms announce status changes.

## Images, media, motion
- [ ] Meaningful images have useful alt text; decorative images use empty alt.
- [ ] Couple photos are not described with unsupported personal inference.
- [ ] Video has captions/transcript when speech is present.
- [ ] Audio does not autoplay without consent and has pause/mute controls.
- [ ] Reduced-motion preference removes nonessential movement.
- [ ] Gallery controls and current-slide status are announced.

## Visual and reflow
- [ ] Text contrast passes AA; UI components and focus cues remain distinguishable.
- [ ] Content works at 200% zoom and reflows at narrow equivalent width.
- [ ] Text spacing changes do not clip or overlap content.
- [ ] Touch targets and spacing support mobile use.
- [ ] Information is not conveyed by color, position, shape, or animation alone.

## Dynamic UI
- [ ] Loading, save status, payment status, RSVP confirmation, and upload progress use appropriate announcements.
- [ ] Toasts remain long enough and do not steal focus.
- [ ] New content does not unexpectedly move focus.
- [ ] Skeletons are hidden from the accessibility tree when appropriate.

## Evidence
- [ ] axe scan attached for all critical states.
- [ ] Keyboard test notes attached.
- [ ] Mobile screen-reader spot check completed for critical journeys.
- [ ] Known exceptions have owner, severity, due date, and approved rationale.
