---
name: responsive-layout-audit
description: Validate Undangania product UI and invitation templates across mobile, tablet, desktop, orientation, zoom, and difficult content fixtures.
---
# Viewports
Minimum: 320x568, 360x800, 375x812, 390x844, 412x915, 768x1024, 1024x768, 1280x800, 1440x900. Include landscape for editor and checkout.

# Procedure
1. Load normal, long-name, long-address, multi-event, missing-optional, large-gallery, validation-error, and Indonesian/English fixtures.
2. Inspect viewport meta, overflow, container widths, safe areas, sticky/fixed elements, dialogs, drawers, menus, tables, forms, editor/preview, media aspect ratios, and text wrapping.
3. Verify content order remains meaningful and primary action remains reachable without obscuring focused controls.
4. Test touch target spacing, virtual keyboard impact, orientation change, 200% browser zoom, text-only zoom, and dynamic viewport height.
5. Test slow images/fonts and ensure reserved dimensions prevent layout shifts.
6. Capture screenshots and compare approved baselines. Do not approve by inspecting CSS alone.

# Release gate
BLOCK on horizontal page overflow, clipped names/date/venue, inaccessible primary action, fixed content hiding focus or form fields, unreadable zoom/reflow, broken editor preview, or mobile layout shift that changes user action.
