---
name: accessibility-audit
description: Audit Wedding System UI against WCAG-oriented accessibility requirements using source inspection, axe automation, keyboard checks, and manual verification.
---
# Required context
Read AGENTS, active task, UI/UX rule, affected screen, component states, and acceptance criteria.

# Procedure
1. Identify page purpose, landmarks, heading structure, forms, dialogs, menus, media, live regions, and dynamic states.
2. Run Playwright and axe against default, validation-error, loading, empty, success, disabled, dialog-open, and dynamically updated states.
3. Test keyboard-only navigation: skip link, tab order, visible focus, focus trap, focus return, escape, arrow-key patterns, and no keyboard trap.
4. Inspect accessible names, descriptions, form labels, error association, required state, status announcements, image alternatives, decorative media, and icon-only controls.
5. Check text contrast, non-text contrast, zoom/reflow at 200% and 400%, touch target sizing, focus visibility, reduced motion, and autoplay controls.
6. Test public invitation without JavaScript for essential reading where progressive enhancement is required.
7. Record automated violations separately from manual findings. Never claim full accessibility compliance from automation alone.

# Release gate
BLOCK on keyboard traps, inaccessible primary action, unlabeled form controls, hidden critical errors, severe contrast failure, unusable zoom/reflow, inaccessible payment/RSVP, or critical axe violations. Return evidence, selector, state, impact, WCAG reference, remediation, and regression test.
